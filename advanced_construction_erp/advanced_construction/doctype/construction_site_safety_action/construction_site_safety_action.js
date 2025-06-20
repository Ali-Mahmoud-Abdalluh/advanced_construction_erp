// Copyright (c) 2023, Your Company and contributors
// For license information, please see license.txt

frappe.ui.form.on('Construction Site Safety Action', {
	refresh: function(frm) {
		// Set indicator based on status and priority
		set_status_indicator(frm);
		
		// Add quick action buttons
		if (frm.doc.status !== 'Completed' && frm.doc.status !== 'Cancelled') {
			frm.add_custom_button(__('Mark as Completed'), function() {
				frm.set_value('status', 'Completed');
				frm.set_value('completion_date', frappe.datetime.get_today());
				frm.save();
			});
		}
		
		// Check if action is overdue
		check_if_overdue(frm);
	},
	
	priority: function(frm) {
		// Update indicator when priority changes
		set_status_indicator(frm);
		
		// Suggest target date based on priority
		if (frm.doc.priority && !frm.doc.target_date) {
			let today = frappe.datetime.get_today();
			let days_to_add = 0;
			
			switch(frm.doc.priority) {
				case 'High':
					days_to_add = 1; // High priority - 1 day
					break;
				case 'Medium':
					days_to_add = 3; // Medium priority - 3 days
					break;
				case 'Low':
					days_to_add = 7; // Low priority - 7 days
					break;
			}
			
			if (days_to_add > 0) {
				let target_date = frappe.datetime.add_days(today, days_to_add);
				frm.set_value('target_date', target_date);
			}
		}
	},
	
	status: function(frm) {
		// Update indicator when status changes
		set_status_indicator(frm);
		
		// If status is completed, set completion date to today if not already set
		if (frm.doc.status === 'Completed' && !frm.doc.completion_date) {
			frm.set_value('completion_date', frappe.datetime.get_today());
		}
		
		// If status is cancelled, clear completion date
		if (frm.doc.status === 'Cancelled' && frm.doc.completion_date) {
			frm.set_value('completion_date', '');
		}
	},
	
	target_date: function(frm) {
		// Check if action is overdue
		check_if_overdue(frm);
	},
	
	completion_date: function(frm) {
		// If completion date is set, status should be completed
		if (frm.doc.completion_date && frm.doc.status !== 'Completed') {
			frm.set_value('status', 'Completed');
		}
		
		// Validate completion date is not in the future
		if (frm.doc.completion_date) {
			let today = frappe.datetime.get_today();
			if (frm.doc.completion_date > today) {
				frappe.msgprint({
					title: __('Invalid Date'),
					indicator: 'red',
					message: __('Completion Date cannot be in the future')
				});
				frm.set_value('completion_date', today);
			}
		}
	}
});

function set_status_indicator(frm) {
	if (frm.doc.status) {
		let indicator = 'gray';
		
		// Set indicator color based on status and priority
		switch(frm.doc.status) {
			case 'Open':
				indicator = frm.doc.priority === 'High' ? 'red' : 
							frm.doc.priority === 'Medium' ? 'orange' : 'blue';
				break;
			case 'In Progress':
				indicator = 'blue';
				break;
			case 'Delayed':
				indicator = 'orange';
				break;
			case 'Completed':
				indicator = 'green';
				break;
			case 'Cancelled':
				indicator = 'gray';
				break;
			default:
				indicator = 'gray';
		}
		
		// Set the indicator
		frm.set_indicator(indicator, frm.doc.status);
	}
}

function check_if_overdue(frm) {
	if (frm.doc.target_date && ['Open', 'In Progress'].includes(frm.doc.status)) {
		let today = frappe.datetime.get_today();
		if (frm.doc.target_date < today) {
			// Action is overdue
			frm.set_value('status', 'Delayed');
			
			// Calculate days overdue
			let target_date = frappe.datetime.str_to_obj(frm.doc.target_date);
			let current_date = frappe.datetime.str_to_obj(today);
			let days_diff = frappe.datetime.get_diff(current_date, target_date);
			
			frappe.show_alert({
				message: __('Action is overdue by {0} days', [days_diff]),
				indicator: 'red'
			});
		}
	}
}