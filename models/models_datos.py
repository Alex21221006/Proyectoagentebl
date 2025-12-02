from odoo import models, fields, api


class AgentReceipt(models.Model):
    _name = "agent.receipt"
    _description = "Boleta / Movimiento Agente Multibanco"

    name = fields.Char(
        string="N° Boleta",
        readonly=True,
        copy=False,
        default="Nuevo"
    )

    date = fields.Date(
        string="Fecha",
        required=True,
        default=fields.Date.context_today
    )

    bank = fields.Char(string="Banco / Red", required=True)
    movement = fields.Char(string="Tipo de movimiento", required=True)

    operator_id = fields.Many2one(
        "res.users",
        string="Operador",
        required=True,
        default=lambda self: self.env.user,
    )

    # Solicitante
    solicitante_dni = fields.Char(string="DNI solicitante")
    solicitante_nombre = fields.Char(string="Nombre solicitante")

    # Beneficiario
    beneficiario_dni = fields.Char(string="DNI beneficiario")
    beneficiario_nombre = fields.Char(string="Nombre beneficiario")

    account = fields.Char(string="N° cuenta / N° celular")
    description = fields.Char(string="Descripción")

    amount = fields.Float(string="Monto", required=True)
    fee = fields.Float(string="Comisión")
    total = fields.Float(string="Total", compute="_compute_total", store=True)

    cancelled = fields.Boolean(string="Anulado", default=False)

    created_at = fields.Datetime(
        string="Creado en",
        default=fields.Datetime.now,
        readonly=True
    )

    @api.depends("amount", "fee")
    def _compute_total(self):
        for rec in self:
            rec.total = (rec.amount or 0.0) + (rec.fee or 0.0)

    @api.model
    def create(self, vals):
        if vals.get("name", "Nuevo") == "Nuevo":
            # Puedes crear una secuencia más adelante si quieres algo tipo AG-00001
            vals["name"] = self.env["ir.sequence"].next_by_code(
                "agent.receipt"
            ) or "Nuevo"
        return super().create(vals)
