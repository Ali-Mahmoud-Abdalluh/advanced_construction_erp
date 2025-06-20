frappe.query_reports["Construction Project Status"] = {
    "filters": [
        {
            "fieldname": "project",
            "label": __("Project"),
            "fieldtype": "Link",
            "options": "Project"
        },
        {
            "fieldname": "construction_type",
            "label": __("Construction Type"),
            "fieldtype": "Select",
            "options": "Building\nInfrastructure\nIndustrial\nResidential\nCommercial"
        },
        {
            "fieldname": "status",
            "label": __("Status"),
            "fieldtype": "Select",
            "options": "Not Started\nIn Progress\nOn Hold\nCompleted\nCancelled"
        },
        {
            "fieldname": "from_date",
            "label": __("From Date"),
            "fieldtype": "Date"
        },
        {
            "fieldname": "to_date",
            "label": __("To Date"),
            "fieldtype": "Date"
        },
        {
            "fieldname": "project_manager",
            "label": __("Project Manager"),
            "fieldtype": "Link",
            "options": "User"
        }
    ],

    "formatter": function(value, row, column, data, default_formatter) {
        value = default_formatter(value, row, column, data);

        if (column.fieldname === "status") {
            if (data.status === "Completed") {
                value = `<span class="status-badge completed">${value}</span>`;
            } else if (data.status === "In Progress") {
                value = `<span class="status-badge in-progress">${value}</span>`;
            } else if (data.status === "On Hold") {
                value = `<span class="status-badge on-hold">${value}</span>`;
            } else if (data.status === "Cancelled") {
                value = `<span class="status-badge cancelled">${value}</span>`;
            } else {
                value = `<span class="status-badge not-started">${value}</span>`;
            }
        }

        if (column.fieldname === "cost_variance") {
            if (data.cost_variance < 0) {
                value = `<span style="color: red">${value}</span>`;
            } else if (data.cost_variance > 0) {
                value = `<span style="color: green">${value}</span>`;
            }
        }

        return value;
    },

    "onload": function(report) {
        report.page.add_inner_button(__("Export to Excel"), function() {
            var filters = report.get_values();
            window.location.href = `/api/method/construction_project.construction_project.report.construction_project_status.construction_project_status.export_to_excel?filters=${JSON.stringify(filters)}`;
        });
    }
}; 