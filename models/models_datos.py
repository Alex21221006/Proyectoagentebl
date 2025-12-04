from odoo import models, fields, api
import os
import requests
import logging

_logger = logging.getLogger(__name__)


# ============================
#   Config Decolecta
# ============================
DECOLECTA_TOKEN = (os.getenv("DECOLECTA_TOKEN") or "").strip()
DECOLECTA_DNI_URL = "https://api.decolecta.com/v1/reniec/dni"


class AgentReceipt(models.Model):
    _name = "agent.receipt"
    _description = "Boleta / Movimiento Agente Multibanco"

    # ---------------------------
    # Datos generales de la boleta
    # ---------------------------
    name = fields.Char(
        string="N° Boleta",
        readonly=True,
        copy=False,
        default="Nuevo",
    )

    date = fields.Date(
        string="Fecha",
        required=True,
        default=fields.Date.context_today,
    )

    # ---------------------------
    # Banco / Red y Tipo de movimiento
    # ---------------------------
    bank = fields.Selection(
        [
            ("bcp", "BCP"),
            ("interbank", "Interbank"),
            ("bbva", "BBVA"),
            ("scotiabank", "Scotiabank"),
            ("caja_arequipa", "Caja Arequipa"),
            ("caja_cusco", "Caja Cusco"),
            ("banco_nacion", "Banco de la Nación"),
            ("yape", "Yape"),
            ("plin", "Plin"),
            ("bim", "BIM"),
            ("kasnet", "Kasnet"),
            ("pagaya", "Pagaya"),
            ("bitel", "Bitel"),
            ("entel", "Entel"),
            ("movistar", "Movistar"),
            ("claro", "Claro"),
            ("azulito", "Azulito"),
            ("otros", "Otros"),
        ],
        string="Banco / Red",
        required=True,
    )

    movement = fields.Selection(
        [
            ("deposit", "Depósito"),
            ("withdrawal", "Retiro"),
            ("money_order", "Giro"),
            ("payment", "Pago"),
            ("topup", "Recarga"),
            ("other", "Otros"),
        ],
        string="Tipo de movimiento",
        required=True,
    )

    operator_id = fields.Many2one(
        "res.users",
        string="Operador",
        default=lambda self: self.env.user,
        readonly=True,
    )

    account = fields.Char(string="N° cuenta / N° celular")
    description = fields.Text(string="Descripción")
    cancelled = fields.Boolean(string="Anulado")

    # ---------------------------
    # Datos del solicitante
    # ---------------------------
    solicitante_dni = fields.Char(string="DNI solicitante")
    solicitante_nombre = fields.Char(string="Nombre solicitante")

    # ---------------------------
    # Datos del beneficiario
    # ---------------------------
    beneficiario_dni = fields.Char(string="DNI beneficiario")
    beneficiario_nombre = fields.Char(string="Nombre beneficiario")

    # ---------------------------
    # Montos
    # ---------------------------
    currency_id = fields.Many2one(
        "res.currency",
        string="Moneda",
        default=lambda self: self.env.company.currency_id.id,
    )

    amount = fields.Monetary(
        string="Monto",
        currency_field="currency_id",
    )

    fee = fields.Monetary(
        string="Comisión",
        currency_field="currency_id",
    )

    total = fields.Monetary(
        string="Total",
        currency_field="currency_id",
        compute="_compute_total",
        store=True,
        readonly=True,
    )

    @api.depends("amount", "fee")
    def _compute_total(self):
        for rec in self:
            rec.total = (rec.amount or 0.0) + (rec.fee or 0.0)

    # =====================================================
    #   Helpers internos para consultar Decolecta
    # =====================================================
    def _fetch_dni_from_decolecta(self, dni):
        """Llama a Decolecta RENIEC/DNI y devuelve dict con nombre completo."""
        if not DECOLECTA_TOKEN:
            _logger.warning("DECOLECTA_TOKEN no está configurado en el entorno.")
            return None

        dni = (dni or "").strip()
        if not dni or len(dni) != 8 or not dni.isdigit():
            return None

        url = f"{DECOLECTA_DNI_URL}?numero={dni}"
        headers = {
            "Accept": "application/json",
            "Authorization": f"Bearer {DECOLECTA_TOKEN}",
        }

        try:
            resp = requests.get(url, headers=headers, timeout=10)
            data = resp.json()
        except Exception as e:
            _logger.exception("Error al consultar Decolecta DNI: %s", e)
            return None

        raw = data.get("data", data) if isinstance(data, dict) else {}

        nombres = (
            raw.get("nombres")
            or raw.get("first_name")
            or ""
        ).strip()

        ap_pat = (
            raw.get("apellidoPaterno")
            or raw.get("apellido_paterno")
            or raw.get("first_last_name")
            or ""
        ).strip()

        ap_mat = (
            raw.get("apellidoMaterno")
            or raw.get("apellido_materno")
            or raw.get("second_last_name")
            or ""
        ).strip()

        nombre_completo = (
            raw.get("full_name")
            or " ".join([ap_pat, ap_mat, nombres])
        ).strip()

        if not any([nombres, ap_pat, ap_mat, nombre_completo]):
            return None

        return {
            "numero": raw.get("document_number", dni),
            "nombres": nombres,
            "apellidoPaterno": ap_pat,
            "apellidoMaterno": ap_mat,
            "nombreCompleto": nombre_completo,
        }

    # =====================================================
    #   ONCHANGE: autocompletar nombres por DNI
    # =====================================================
    @api.onchange("solicitante_dni")
    def _onchange_solicitante_dni(self):
        for rec in self:
            dni = (rec.solicitante_dni or "").strip()
            rec.solicitante_nombre = False

            info = rec._fetch_dni_from_decolecta(dni)
            if info:
                rec.solicitante_nombre = info["nombreCompleto"]

    @api.onchange("beneficiario_dni")
    def _onchange_beneficiario_dni(self):
        for rec in self:
            dni = (rec.beneficiario_dni or "").strip()
            rec.beneficiario_nombre = False

            info = rec._fetch_dni_from_decolecta(dni)
            if info:
                rec.beneficiario_nombre = info["nombreCompleto"]
