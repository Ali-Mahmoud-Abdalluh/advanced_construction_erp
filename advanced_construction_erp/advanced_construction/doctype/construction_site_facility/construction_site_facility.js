// Copyright (c) 2023, Your Company and contributors
// For license information, please see license.txt

frappe.ui.form.on('Construction Site Facility', {
	refresh: function(frm) {
		// Add custom buttons or indicators if needed
		set_maintenance_indicator(frm);
	},
	
	status: function(frm) {
		// Update UI based on status
		if (frm.doc.status === 'Under Maintenance') {
			// If status is under maintenance, suggest setting a maintenance due date
			if (!frm.doc.maintenance_due_date) {
				let suggested_date = frappe.datetime.add_days(frappe.datetime.get_today(), 7);
				frm.set_value('maintenance_due_date', suggested_date);
				frappe.show_alert({
					message: __('Maintenance due date set to 7 days from today'),
					indicator: 'blue'
				});
			}
		}
	},
	
	installation_date: function(frm) {
		// Validate installation date is not in the future
		if (frm.doc.installation_date) {
			let today = frappe.datetime.get_today();
			if (frm.doc.installation_date > today) {
				frappe.msgprint({
					title: __('Invalid Date'),
					indicator: 'red',
					message: __('Installation Date cannot be in the future')
				});
				frm.set_value('installation_date', today);
			}
			
			// If maintenance due date is set, validate it's after installation date
			if (frm.doc.maintenance_due_date && frm.doc.maintenance_due_date < frm.doc.installation_date) {
				frappe.msgprint({
					title: __('Invalid Date'),
					indicator: 'red',
					message: __('Maintenance Due Date cannot be before Installation Date')
				});
				frm.set_value('maintenance_due_date', '');
			}
		}
	},
	
	maintenance_due_date: function(frm) {
		// Check if maintenance is due or overdue
		set_maintenance_indicator(frm);
	}
});

function set_maintenance_indicator(frm) {
	if (frm.doc.maintenance_due_date) {
		let today = frappe.datetime.get_today();
		let days_to_maintenance = frappe.datetime.get_diff(frm.doc.maintenance_due_date, today);
		
		if (days_to_maintenance < 0) {
			// Maintenance is overdue
			frm.set_indicator('red', 'Maintenance Overdue');
			if (frm.doc.status !== 'Under Maintenance') {
				frappe.show_alert({
					message: __('Maintenance is overdue by {0} days', [Math.abs(days_to_maintenance)]),
					indicator: 'red'
				});
			}
		} else if (days_to_maintenance <= 7) {
			// Maintenance is due soon
			frm.set_indicator('orange', 'Maintenance Due Soon');
			if (frm.doc.status !== 'Under Maintenance') {
				frappe.show_alert({
					message: __('Maintenance due in {0} days', [days_to_maintenance]),
					indicator: 'orange'
				});
			}
		} else {
			// Maintenance is not due yet
			frm.set_indicator('green', 'Maintenance Scheduled');
		}
	}
}