// Copyright (c) 2023, Your Company and contributors
// For license information, please see license.txt

frappe.ui.form.on('Project Phase', {
	refresh: function(frm) {
		// Add custom buttons or indicators if needed
		
		// Set indicator color based on phase status
		frm.set_indicator_formatter('phase_status',
			function(doc) {
				let colors = {
					'Not Started': 'gray',
					'In Progress': 'blue',
					'Completed': 'green',
					'Delayed': 'orange',
					'On Hold': 'yellow',
					'Cancelled': 'red'
				};
				return colors[doc.phase_status] || 'gray';
			}
		);
	},
	
	start_date: function(frm) {
		// Recalculate duration when start date changes
		if (frm.doc.start_date && frm.doc.end_date) {
			calculate_duration(frm);
		}
		
		// Validate dependencies
		validate_dependencies(frm);
	},
	
	end_date: function(frm) {
		// Recalculate duration when end date changes
		if (frm.doc.start_date && frm.doc.end_date) {
			calculate_duration(frm);
		}
	},
	
	duration: function(frm) {
		// Update end date if start date and duration are set
		if (frm.doc.start_date && frm.doc.duration) {
			let start_date = frappe.datetime.str_to_obj(frm.doc.start_date);
			let end_date = new Date(start_date);
			end_date.setDate(start_date.getDate() + cint(frm.doc.duration) - 1); // -1 because duration includes start date
			frm.set_value('end_date', frappe.datetime.obj_to_str(end_date));
		}
	},
	
	dependencies: function(frm) {
		// Validate dependencies when they change
		validate_dependencies(frm);
	}
});

function calculate_duration(frm) {
	let start_date = frappe.datetime.str_to_obj(frm.doc.start_date);
	let end_date = frappe.datetime.str_to_obj(frm.doc.end_date);
	
	if (start_date && end_date) {
		let diff_days = frappe.datetime.get_diff(frm.doc.end_date, frm.doc.start_date) + 1; // +1 to include both start and end dates
		frm.set_value('duration', diff_days);
	}
}

function validate_dependencies(frm) {
	if (frm.doc.dependencies && frm.doc.start_date) {
		frappe.call({
			method: "frappe.client.get_list",
			args: {
				doctype: "Project Phase",
				filters: {"name": ["in", frm.doc.dependencies.split(",")]},
				fields: ["name", "end_date"]
			},
			callback: function(r) {
				if (r.message) {
					for (let phase of r.message) {
						if (phase.end_date) {
							let dependency_end = frappe.datetime.str_to_obj(phase.end_date);
							let phase_start = frappe.datetime.str_to_obj(frm.doc.start_date);
							
							if (phase_start < dependency_end) {
								frappe.msgprint(
									__('Warning: Start Date is before End Date of dependent phase {0}', [phase.name])
								);
							}
						}
					}
				}
			}
		});
	}
}