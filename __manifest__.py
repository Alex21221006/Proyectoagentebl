{
    "name": "Agente Multibanco B&L",
    "version": "19.0.1.0.0",
    "author": "B&L",
    "license": "LGPL-3",
    "depends": [
        "base",
        "web",
        "website",
    ],
    "data": [
        "security/ir.model.access.csv",
        "data/ir_sequence.xml",
        "views/agent_receipt_views.xml",
        "views/views_agentebl_templates.xml",
        "views/agent_menu.xml",
        "report/report_agent_receipt.xml",
    ],
    "assets": {
        "web.assets_frontend": [
            "moduloagentebl/static/src/css/styles.css",
            "moduloagentebl/static/src/js/script.js",
        ],
        "website.assets_frontend": [
            "moduloagentebl/static/src/css/styles.css",
            "moduloagentebl/static/src/js/script.js",
        ],
    },
    "installable": True,
    "application": True,
}
