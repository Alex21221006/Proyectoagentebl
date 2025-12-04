# -*- coding: utf-8 -*-
from odoo import models, fields, api, _


class AgentReceipt(models.Model):
    _name = "agent.receipt"
    _description = "Boleta / Movimiento Agente Multibanco"
    _order = "date desc, name desc"

    # =========================
    # Datos generales
    # =========================
    name = fields.Char(
        string="N° Boleta",
        readonly=True,
        copy=False,
        default=lambda self: _("Nuevo"),
    )

    date = fields.Date(
        string="Fecha",
        required=True,
        default=fields.Date.context_today,
    )

    # ---------- AQUÍ VIENE LO IMPORTANTE ----------
    # Banco / Red como lista desplegable
    bank = fields.Selection(
        [
            ("bcp", "BCP"),
            ("bbva", "BBVA"),
            ("interbank", "Interbank"),
            ("scotiabank", "Scotiabank"),
            ("yape", "Yape"),
            ("plin", "Plin"),
        ],
        string="Banco / Red",
        required=True,
    )

    # Tipo de movimiento como lista desplegable
    movement = fields.Selection(
        [
            ("deposito", "Depósito"),
            ("retiro", "Retiro"),
            ("pago_servicio", "Pago de servicio"),
            ("transferencia", "Transferencia"),
        ],
        string="Tipo de movimiento",
        required=True,
    )
    # ------------------------------------------------

    operator_id = fields.Many2one(
        "res.users",
        string="Operador",
        default=lambda self: self.env.user,
        readonly=True,
    )

    account = fields.Char(
        string="N° cuenta / N° celular",
    )

    description = fields.Text(
        string="Descripción",
    )

    cancelled = fields.Boolean(
        string="Anulado",
        default=False,
    )

    # =========================
    # Solicitante
    # =========================
    solicitante_dni = fields.Char(
        string="DNI solicitante",
    )
    solicitante_nombre = fields.Char(
        string="Nombre solicitante",
    )

    # =========================
    # Beneficiario
    # =========================
    beneficiario_dni = fields.Char(
        string="DNI beneficiario",
    )
    beneficiario_nombre = fields.Char(
        string="Nombre beneficiario",
    )

    # =========================
    # Montos
    # =========================
    currency_id = fields.Many2one(
        "res.currency",
        string="Moneda",
        default=lambda self: self.env.company.currency_id,
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

    # =========================
    # Secuencia para N° Boleta
    # =========================
    @api.model
    def create(self, vals):
        if vals.get("name", _("Nuevo")) == _("Nuevo"):
            vals["name"] = (
                self.env["ir.sequence"].next_by_code("agent.receipt") or _("Nuevo")
            )
        return super(AgentReceipt, self).create(vals)
