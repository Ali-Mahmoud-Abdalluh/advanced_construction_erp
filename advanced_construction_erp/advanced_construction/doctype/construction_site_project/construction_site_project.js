// Copyright (c) 2023, Your Company and contributors
// For license information, please see license.txt

frappe.ui.form.on('Construction Site Project', {
	refresh: function(frm) {
		// Add custom buttons or indicators if needed
		set_project_indicator(frm);
	},
	
	construction_project: function(frm) {
		// When construction project is selected, fetch project details
		if (frm.doc.construction_project) {
			frappe.db.get_doc('Construction Project', frm.doc.construction_project)
				.then(project => {
					// Update fields from the project
					frm.set_value('project_name', project.project_name);
					frm.set_value('project', project.erpnext_project);
					frm.set_value('status', project.status);
					frm.set_value('start_date', project.expected_start_date);
					frm.set_value('end_date', project.expected_end_date);
					frm.set_value('completion_percentage', project.completion_percentage);
					
					// Update indicator
					set_project_indicator(frm);
				});
		}
	},
	
	status: function(frm) {
		// Update indicator when status changes
		set_project_indicator(frm);
	},
	
	completion_percentage: function(frm) {
		// Update indicator when completion percentage changes
		set_project_indicator(frm);
	}
});

function set_project_indicator(frm) {
	if (frm.doc.status) {
		let indicator = 'gray';
		let status_text = frm.doc.status;
		
		// Set indicator color based on status and completion
		switch(frm.doc.status) {
			case 'Planning':
				indicator = 'blue';
				break;
			case 'In Progress':
				// For in progress, use different colors based on completion percentage
				if (frm.doc.completion_percentage !== undefined) {
					if (frm.doc.completion_percentage < 25) {
						indicator = 'orange';
						status_text = 'Early Stage';
					} else if (frm.doc.completion_percentage < 75) {
						indicator = 'blue';
						status_text = 'In Progress';
					} else {
						indicator = 'green';
						status_text = 'Nearing Completion';
					}
				} else {
					indicator = 'blue';
				}
				break;
			case 'Completed':
				indicator = 'green';
				break;
			case 'On Hold':
				indicator = 'orange';
				break;
			case 'Cancelled':
				indicator = 'red';
				break;
			default:
				indicator = 'gray';
		}
		
		// Set the indicator
		frm.set_indicator(indicator, status_text);
		
		// If project has end date, check if it's overdue
		if (frm.doc.end_date && ['Planning', 'In Progress'].includes(frm.doc.status)) {
			let today = frappe.datetime.get_today();
			if (frm.doc.end_date < today) {
				frm.set_indicator('red', 'Overdue');
				frappe.show_alert({
					message: __('Project is overdue'),
					indicator: 'red'
				});
			}
		}
	}
}