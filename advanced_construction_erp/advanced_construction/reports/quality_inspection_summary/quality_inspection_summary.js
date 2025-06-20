// Copyright (c) 2024, Your Company and contributors
// For license information, please see license.txt

frappe.query_reports["Quality Inspection Summary"] = {
    "filters": [
        {
            "fieldname": "from_date",
            "label": __("From Date"),
            "fieldtype": "Date",
            "default": frappe.datetime.add_months(frappe.datetime.get_today(), -3),
            "reqd": 1
        },
        {
            "fieldname": "to_date",
            "label": __("To Date"),
            "fieldtype": "Date",
            "default": frappe.datetime.get_today(),
            "reqd": 1
        },
        {
            "fieldname": "project",
            "label": __("Project"),
            "fieldtype": "Link",
            "options": "Construction Project"
        },
        {
            "fieldname": "inspection_type",
            "label": __("Inspection Type"),
            "fieldtype": "Select",
            "options": "\nMaterial\nWorkmanship\nEquipment\nSafety\nEnvironmental\nRegulatory\nOther"
        },
        {
            "fieldname": "status",
            "label": __("Status"),
            "fieldtype": "Select",
            "options": "\nDraft\nInspection Scheduled\nInspection Completed\nApproved\nRejected\nCancelled"
        }
    ],
    
    "formatter": function(value, row, column, data, default_formatter) {
        value = default_formatter(value, row, column, data);
        
        if (column.fieldname == "approval_rate" && data) {
            if (data.approval_rate >= 90) {
                value = `<span style="color: green; font-weight: bold;">${value}</span>`;
            } else if (data.approval_rate >= 70) {
                value = `<span style="color: orange; font-weight: bold;">${value}</span>`;
            } else if (data.approval_rate > 0) {
                value = `<span style="color: red; font-weight: bold;">${value}</span>`;
            }
        }
        
        if (column.fieldname == "avg_quality_score" && data) {
            if (data.avg_quality_score >= 90) {
                value = `<span style="color: green; font-weight: bold;">${value}</span>`;
            } else if (data.avg_quality_score >= 70) {
                value = `<span style="color: orange; font-weight: bold;">${value}</span>`;
            } else if (data.avg_quality_score > 0) {
                value = `<span style="color: red; font-weight: bold;">${value}</span>`;
            }
        }
        
        if (column.fieldname == "critical_failures" && data && data.critical_failures > 0) {
            value = `<span style="color: red; font-weight: bold;">${value}</span>`;
        }
        
        if (data && data.is_group) {
            value = `<span style="font-weight: bold;">${value}</span>`;
        }
        
        return value;
    },
    
    "onload": function(report) {
        report.page.add_inner_button(__("Create Quality Checklist"), function() {
            frappe.set_route("Form", "Quality Checklist", "new-quality-checklist");
        });
        
        report.page.add_inner_button(__("Create Quality Inspection"), function() {
            frappe.set_route("Form", "Quality Inspection", "new-quality-inspection");
        });
    }
}; 