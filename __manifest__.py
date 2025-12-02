{
    "name": "Agente Multibanco B&L",
    "version": "19.0.1.0.0",
    "depends": ["base", "web", "website"],
    "data": [
        "security/ir.model.access.csv",
        "data/ir_sequence.xml",
        "views/views_agentebl_templates.xml",
        "views/agent_receipt_views.xml",
        "views/agent_menu.xml",
    ],
'assets': {
    'web.assets_frontend': [
        'agentemultibancobl/static/src/css/styles.css',
        'agentemultibancobl/static/src/js/script.js',
    ],
    'website.assets_frontend': [
        'agentemultibancobl/static/src/css/styles.css',
        'agentemultibancobl/static/src/js/script.js',
    ],
},


    "installable": True,
    "application": True,
}



