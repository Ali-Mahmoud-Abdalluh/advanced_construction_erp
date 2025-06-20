// Copyright (c) 2023, Your Company and contributors
// For license information, please see license.txt

frappe.ui.form.on('Construction Site Document', {
	refresh: function(frm) {
		// Add custom buttons or indicators if needed
	},
	
	expiry_date: function(frm) {
		// Check if document is expired or about to expire
		if (frm.doc.expiry_date) {
			let today = frappe.datetime.get_today();
			let expiry = frappe.datetime.str_to_obj(frm.doc.expiry_date);
			let today_obj = frappe.datetime.str_to_obj(today);
			
			// Calculate days to expiry
			let days_to_expiry = frappe.datetime.get_diff(frm.doc.expiry_date, today);
			
			// Set indicator based on expiry status
			if (days_to_expiry < 0) {
				// Document has expired
				frm.set_indicator('red', 'Expired');
				frappe.show_alert({
					message: __('This document has expired'),
					indicator: 'red'
				});
			} else if (days_to_expiry <= 30) {
				// Document will expire soon
				frm.set_indicator('orange', 'Expiring Soon');
				frappe.show_alert({
					message: __('This document will expire in {0} days', [days_to_expiry]),
					indicator: 'orange'
				});
			} else {
				// Document is valid
				frm.set_indicator('green', 'Valid');
			}
		}
	},
	
	issue_date: function(frm) {
		// Validate issue date is not in the future
		if (frm.doc.issue_date) {
			let today = frappe.datetime.get_today();
			if (frm.doc.issue_date > today) {
				frappe.msgprint({
					title: __('Invalid Date'),
					indicator: 'red',
					message: __('Issue Date cannot be in the future')
				});
				frm.set_value('issue_date', today);
			}
			
			// If expiry date is set, validate it's after issue date
			if (frm.doc.expiry_date && frm.doc.expiry_date < frm.doc.issue_date) {
				frappe.msgprint({
					title: __('Invalid Date'),
					indicator: 'red',
					message: __('Expiry Date cannot be before Issue Date')
				});
				frm.set_value('expiry_date', '');
			}
		}
	}
});