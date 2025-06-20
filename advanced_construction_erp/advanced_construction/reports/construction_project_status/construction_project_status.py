from __future__ import unicode_literals
import frappe
from frappe import _
from frappe.utils import getdate, flt

def execute(filters=None):
    if not filters:
        filters = {}

    columns = get_columns()
    data = get_data(filters)

    return columns, data

def get_columns():
    return [
        {
            "label": _("Project"),
            "fieldname": "project",
            "fieldtype": "Link",
            "options": "Project",
            "width": 120
        },
        {
            "label": _("Construction Type"),
            "fieldname": "construction_type",
            "fieldtype": "Data",
            "width": 120
        },
        {
            "label": _("Status"),
            "fieldname": "status",
            "fieldtype": "Data",
            "width": 100
        },
        {
            "label": _("Progress"),
            "fieldname": "progress",
            "fieldtype": "Percent",
            "width": 100
        },
        {
            "label": _("Start Date"),
            "fieldname": "start_date",
            "fieldtype": "Date",
            "width": 100
        },
        {
            "label": _("End Date"),
            "fieldname": "end_date",
            "fieldtype": "Date",
            "width": 100
        },
        {
            "label": _("Total Budget"),
            "fieldname": "total_budget",
            "fieldtype": "Currency",
            "width": 120
        },
        {
            "label": _("Actual Cost"),
            "fieldname": "actual_cost",
            "fieldtype": "Currency",
            "width": 120
        },
        {
            "label": _("Cost Variance"),
            "fieldname": "cost_variance",
            "fieldtype": "Currency",
            "width": 120
        },
        {
            "label": _("Project Manager"),
            "fieldname": "project_manager",
            "fieldtype": "Link",
            "options": "User",
            "width": 120
        }
    ]

def get_data(filters):
    conditions = get_conditions(filters)
    
    data = frappe.db.sql("""
        SELECT 
            cp.project,
            cp.construction_type,
            cp.status,
            cp.progress,
            cp.expected_start_date as start_date,
            cp.expected_end_date as end_date,
            cp.total_budget,
            cp.actual_cost,
            (cp.total_budget - cp.actual_cost) as cost_variance,
            cp.project_manager
        FROM 
            `tabConstruction Project` cp
        WHERE 
            {conditions}
        ORDER BY 
            cp.expected_start_date DESC
    """.format(conditions=conditions), filters, as_dict=1)

    return data

def get_conditions(filters):
    conditions = "1=1"
    
    if filters.get("project"):
        conditions += " AND cp.project = %(project)s"
    
    if filters.get("construction_type"):
        conditions += " AND cp.construction_type = %(construction_type)s"
    
    if filters.get("status"):
        conditions += " AND cp.status = %(status)s"
    
    if filters.get("from_date"):
        conditions += " AND cp.expected_start_date >= %(from_date)s"
    
    if filters.get("to_date"):
        conditions += " AND cp.expected_end_date <= %(to_date)s"
    
    if filters.get("project_manager"):
        conditions += " AND cp.project_manager = %(project_manager)s"

    return conditions 