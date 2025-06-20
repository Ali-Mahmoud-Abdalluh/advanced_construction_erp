// Copyright (c) 2023, Your Company and contributors
// For license information, please see license.txt

frappe.ui.form.on('Project Budget Category', {
	refresh: function(frm) {
		// Add custom buttons or indicators if needed
	},
	
	budgeted_amount: function(frm) {
		// Recalculate variance when budgeted amount changes
		calculate_variance(frm);
		
		// Notify parent form to recalculate totals
		if (frm.doc.parent) {
			frappe.model.trigger(frm.doc.parenttype, 'budget_categories');
		}
	},
	
	actual_spent: function(frm) {
		// Recalculate variance when actual spent changes
		calculate_variance(frm);
		
		// Notify parent form to recalculate totals
		if (frm.doc.parent) {
			frappe.model.trigger(frm.doc.parenttype, 'budget_categories');
		}
	}
});

function calculate_variance(frm) {
	if (frm.doc.budgeted_amount !== undefined && frm.doc.actual_spent !== undefined) {
		let variance = flt(frm.doc.budgeted_amount) - flt(frm.doc.actual_spent);
		frm.set_value('variance', variance);
	} else {
		frm.set_value('variance', 0);
	}
}