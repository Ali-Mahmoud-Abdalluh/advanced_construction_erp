from __future__ import unicode_literals
from frappe import _

def get_data():
    return [
        {
            "label": _("Pre-Construction Management"),
            "items": [
                {
                    "type": "doctype",
                    "name": "Construction Lead",
                    "description": _("Leads for potential construction projects"),
                    "onboard": 1,
                },
                {
                    "type": "doctype",
                    "name": "Construction Opportunity",
                    "description": _("Qualified leads and opportunities for construction projects"),
                    "onboard": 1,
                },
                {
                    "type": "doctype",
                    "name": "Site Feasibility Analysis",
                    "description": _("Analysis of site feasibility for construction projects"),
                    "onboard": 1,
                },
                {
                    "type": "doctype",
                    "name": "Pre Construction Plan",
                    "description": _("Pre-construction planning document"),
                    "onboard": 1,
                }
            ]
        },
        {
            "label": _("Reports"),
            "items": [
                {
                    "type": "report",
                    "name": "Lead Conversion Analysis",
                    "doctype": "Construction Lead",
                    "is_query_report": True,
                },
                {
                    "type": "report",
                    "name": "Opportunity Pipeline",
                    "doctype": "Construction Opportunity",
                    "is_query_report": True,
                },
                {
                    "type": "report",
                    "name": "Feasibility Studies Summary",
                    "doctype": "Site Feasibility Analysis",
                    "is_query_report": True,
                }
            ]
        },
        {
            "label": _("Settings"),
            "items": [
                {
                    "type": "doctype",
                    "name": "Pre Construction Settings",
                    "description": _("Settings for Pre-Construction module"),
                    "onboard": 1,
                }
            ]
        }
    ]
