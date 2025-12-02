from odoo import http
from odoo.http import request
import os
import requests
import logging

_logger = logging.getLogger(__name__)

# ===== Config Decolecta =====
MOCK_MODE = os.getenv("MOCK_MODE", "0") == "1"
TOKEN = (os.getenv("DECOLECTA_TOKEN") or "").strip()


def _bearer():
    return {"Accept": "application/json", "Authorization": f"Bearer {TOKEN}"}


class AgenteMultibancoBL(http.Controller):

    # ===== Página principal =====
    @http.route('/agente_multibanco', type='http', auth='user', website=True)
    def agente_multibanco_page(self, **kw):
        return request.render('moduloagentebl.agente_bl_page', {})

    # ===== API: DNI =====
    @http.route(
        '/agente_multibanco/api/dni',
        type='json',
        auth='user',
        methods=['POST'],
        csrf=False,
    )
    def api_dni(self, **kw):
        """
        Recibe JSON: { "numero": "72951012" }
        Devuelve JSON normalizado con nombre completo, etc.
        """
        data = request.jsonrequest or {}
        numero = (data.get("numero") or "").strip()

        if not numero:
            return {"error": "Falta campo 'numero'."}

        # --- MODO DEMO ---
        if os.getenv("MOCK_MODE", "0") == "1":
            mockbook = {
                "72951012": {
                    "nombres": "MANUEL ALEXANDER",
                    "apellidoPaterno": "BERMEJO",
                    "apellidoMaterno": "LOPEZ",
                },
                "00000001": {
                    "nombres": "JUAN",
                    "apellidoPaterno": "PEREZ",
                    "apellidoMaterno": "GARCIA",
                },
                "00000002": {
                    "nombres": "MARIA",
                    "apellidoPaterno": "GOMEZ",
                    "apellidoMaterno": "ROJAS",
                },
            }
            info = mockbook.get(numero)
            if not info:
                return {"error": "No se encontró información para ese DNI."}
            return {
                "numero": numero,
                "nombres": info["nombres"],
                "apellidoPaterno": info["apellidoPaterno"],
                "apellidoMaterno": info["apellidoMaterno"],
                "nombreCompleto": f"{info['apellidoPaterno']} {info['apellidoMaterno']} {info['nombres']}".strip(),
            }

        # --- PROVEEDOR REAL ---
        if not TOKEN:
            return {"error": "DECOLECTA_TOKEN no configurado en el servidor."}

        url = f"https://api.decolecta.com/v1/reniec/dni?numero={numero}"
        try:
            r = requests.get(url, headers=_bearer(), timeout=12)
            status = r.status_code
            data = r.json()
        except Exception as e:
            _logger.exception("Error conectando a Decolecta")
            return {"error": "No se pudo conectar al proveedor", "detail": str(e)}

        _logger.info("Decolecta status: %s", status)
        _logger.info("Decolecta data: %s", data)

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

        if any([nombres, ap_pat, ap_mat, nombre_completo]):
            return {
                "numero": raw.get("document_number", numero),
                "nombres": nombres,
                "apellidoPaterno": ap_pat,
                "apellidoMaterno": ap_mat,
                "nombreCompleto": nombre_completo,
            }

        return {"error": data.get("message") or "No se encontró información para ese DNI."}

    # ===== API: RUC (opcional) =====
    @http.route(
        '/agente_multibanco/api/ruc',
        type='json',
        auth='user',
        methods=['POST'],
        csrf=False,
    )
    def api_ruc(self, **kw):
        data = request.jsonrequest or {}
        numero = (data.get("numero") or "").strip()

        if not numero:
            return {"error": "Falta campo 'numero'."}

        if MOCK_MODE:
            return {
                "numero": numero,
                "razonSocial": "EMPRESA DEMO S.A.C.",
                "estado": "ACTIVO",
                "condicion": "HABIDO",
                "direccion": "Av. Principal 123, Puerto Maldonado",
            }

        if not TOKEN:
            return {"error": "DECOLECTA_TOKEN no configurado en el servidor."}

        url = f"https://api.decolecta.com/v1/sunat/ruc?numero={numero}"
        try:
            r = requests.get(url, headers=_bearer(), timeout=12)
            return r.json()
        except Exception as e:
            _logger.exception("Error conectando a Decolecta (RUC)")
            return {"error": "No se pudo conectar al proveedor", "detail": str(e)}

    # ===== API: Guardar recibo en Odoo =====
    @http.route(
        '/agente_multibanco/api/receipt',
        type='json',
        auth='user',
        methods=['POST'],
        csrf=False,
    )
    def api_receipt(self, **kw):
        """
        Recibe un JSON como el que arma tu JS.
        """
        data = request.jsonrequest or {}

        vals = {
            "date": data.get("date"),
            "bank": data.get("bank"),
            "movement": data.get("movement"),
            "amount": data.get("amount") or 0.0,
            "fee": data.get("fee") or 0.0,
            "cancelled": data.get("cancelled") or False,
            "account": data.get("account"),
            "description": data.get("description"),
        }

        # Operador: intenta buscar el usuario por login (ej. "ManuelBL")
        operator_login = (data.get("operator") or "").strip()
        if operator_login:
            user = request.env["res.users"].sudo().search(
                [("login", "=", operator_login)], limit=1
            )
            if user:
                vals["operator_id"] = user.id
            else:
                vals["operator_id"] = request.env.user.id
        else:
            vals["operator_id"] = request.env.user.id

        # Solicitante
        sol = data.get("solicitante") or {}
        vals["solicitante_dni"] = sol.get("dni")
        vals["solicitante_nombre"] = sol.get("nombre")

        # Beneficiario
        ben = data.get("beneficiario") or {}
        vals["beneficiario_dni"] = ben.get("dni")
        vals["beneficiario_nombre"] = ben.get("nombre")

        rec = request.env["agent.receipt"].sudo().create(vals)

        return {
            "id": rec.id,
            "name": rec.name,
            "date": str(rec.date) if rec.date else False,
        }
