# -*- coding: utf-8 -*-
# Copyright (c) 2024, Your Company and contributors
# For license information, please see license.txt

from __future__ import unicode_literals
import frappe
from frappe import _
from frappe.utils import getdate, flt

def execute(filters=None):
    if not filters:
        filters = {}
        
    columns = get_columns()
    data = get_data(filters)
    
    chart_data = get_chart_data(data)
    
    return columns, data, None, chart_data

def get_columns():
    """Return columns for the report"""
    return [
        {
            "fieldname": "project",
            "label": _("Project"),
            "fieldtype": "Link",
            "options": "Construction Project",
            "width": 200
        },
        {
            "fieldname": "inspection_type",
            "label": _("Inspection Type"),
            "fieldtype": "Data",
            "width": 120
        },
        {
            "fieldname": "total_inspections",
            "label": _("Total Inspections"),
            "fieldtype": "Int",
            "width": 120
        },
        {
            "fieldname": "approved",
            "label": _("Approved"),
            "fieldtype": "Int",
            "width": 100
        },
        {
            "fieldname": "rejected",
            "label": _("Rejected"),
            "fieldtype": "Int",
            "width": 100
        },
        {
            "fieldname": "approval_rate",
            "label": _("Approval Rate (%)"),
            "fieldtype": "Percent",
            "width": 120
        },
        {
            "fieldname": "avg_quality_score",
            "label": _("Avg. Quality Score (%)"),
            "fieldtype": "Percent",
            "width": 150
        },
        {
            "fieldname": "critical_failures",
            "label": _("Critical Failures"),
            "fieldtype": "Int",
            "width": 120
        }
    ]

def get_data(filters):
    """Get report data"""
    data = []
    
    # Build conditions
    conditions = []
    if filters.get("from_date"):
        conditions.append("qi.inspection_date >= %(from_date)s")
    if filters.get("to_date"):
        conditions.append("qi.inspection_date <= %(to_date)s")
    if filters.get("project"):
        conditions.append("qi.project = %(project)s")
    if filters.get("inspection_type"):
        conditions.append("qi.inspection_type = %(inspection_type)s")
    if filters.get("status"):
        conditions.append("qi.status = %(status)s")
    
    conditions_str = " AND ".join(conditions) if conditions else "1=1"
    
    # Get all inspections grouped by project and type
    inspections = frappe.db.sql("""
        SELECT 
            qi.project,
            qi.inspection_type,
            COUNT(qi.name) as total_inspections,
            SUM(CASE WHEN qi.status = 'Approved' THEN 1 ELSE 0 END) as approved,
            SUM(CASE WHEN qi.status = 'Rejected' THEN 1 ELSE 0 END) as rejected,
            AVG(qi.quality_score) as avg_quality_score,
            SUM(qi.failed_checks) as total_failures
        FROM 
            `tabQuality Inspection` qi
        WHERE 
            qi.docstatus = 1 AND {0}
        GROUP BY 
            qi.project, qi.inspection_type
        ORDER BY 
            qi.project, qi.inspection_type
    """.format(conditions_str), filters, as_dict=1)
    
    # Get critical failures
    critical_failures = {}
    critical_data = frappe.db.sql("""
        SELECT 
            qi.project,
            qi.inspection_type,
            COUNT(qii.name) as critical_failures
        FROM 
            `tabQuality Inspection` qi
        JOIN 
            `tabQuality Inspection Item` qii ON qii.parent = qi.name
        WHERE 
            qi.docstatus = 1 AND 
            qii.status = 'Fail' AND 
            qii.is_critical = 1 AND
            {0}
        GROUP BY 
            qi.project, qi.inspection_type
    """.format(conditions_str), filters, as_dict=1)
    
    # Create lookup for critical failures
    for row in critical_data:
        key = f"{row.project}_{row.inspection_type}"
        critical_failures[key] = row.critical_failures
    
    # Process data
    for insp in inspections:
        key = f"{insp.project}_{insp.inspection_type}"
        
        # Calculate approval rate
        total_completed = insp.approved + insp.rejected
        approval_rate = (insp.approved / total_completed * 100) if total_completed > 0 else 0
        
        row = {
            "project": insp.project,
            "inspection_type": insp.inspection_type,
            "total_inspections": insp.total_inspections,
            "approved": insp.approved,
            "rejected": insp.rejected,
            "approval_rate": approval_rate,
            "avg_quality_score": insp.avg_quality_score,
            "critical_failures": critical_failures.get(key, 0)
        }
        
        data.append(row)
    
    # Add summary row for each project
    projects = {}
    for row in data:
        if row["project"] not in projects:
            projects[row["project"]] = {
                "total_inspections": 0,
                "approved": 0,
                "rejected": 0,
                "quality_score_sum": 0,
                "quality_score_count": 0,
                "critical_failures": 0
            }
        
        projects[row["project"]]["total_inspections"] += row["total_inspections"]
        projects[row["project"]]["approved"] += row["approved"]
        projects[row["project"]]["rejected"] += row["rejected"]
        projects[row["project"]]["quality_score_sum"] += row["avg_quality_score"] * row["total_inspections"]
        projects[row["project"]]["quality_score_count"] += row["total_inspections"]
        projects[row["project"]]["critical_failures"] += row["critical_failures"]
    
    # Add project summary rows
    for project, values in projects.items():
        total_completed = values["approved"] + values["rejected"]
        approval_rate = (values["approved"] / total_completed * 100) if total_completed > 0 else 0
        avg_quality_score = (values["quality_score_sum"] / values["quality_score_count"]) if values["quality_score_count"] > 0 else 0
        
        data.append({
            "project": project,
            "inspection_type": "<b>Project Total</b>",
            "total_inspections": values["total_inspections"],
            "approved": values["approved"],
            "rejected": values["rejected"],
            "approval_rate": approval_rate,
            "avg_quality_score": avg_quality_score,
            "critical_failures": values["critical_failures"],
            "is_group": 1
        })
    
    return data

def get_chart_data(data):
    """Generate chart data from report data"""
    if not data:
        return None
    
    # Group data by project for chart
    projects = {}
    for row in data:
        # Skip summary rows
        if row.get("is_group"):
            continue
            
        if row["project"] not in projects:
            projects[row["project"]] = {
                "approved": 0,
                "rejected": 0
            }
        
        projects[row["project"]]["approved"] += row["approved"]
        projects[row["project"]]["rejected"] += row["rejected"]
    
    # Prepare chart data
    labels = list(projects.keys())
    approved_data = [projects[p]["approved"] for p in labels]
    rejected_data = [projects[p]["rejected"] for p in labels]
    
    chart = {
        "data": {
            "labels": labels,
            "datasets": [
                {
                    "name": "Approved",
                    "values": approved_data
                },
                {
                    "name": "Rejected",
                    "values": rejected_data
                }
            ]
        },
        "type": "bar",
        "colors": ["#28a745", "#dc3545"],
        "axisOptions": {
            "xAxisMode": "tick",
            "xIsSeries": True
        },
        "barOptions": {
            "stacked": False,
            "spaceRatio": 0.5
        }
    }
    
    return chart 