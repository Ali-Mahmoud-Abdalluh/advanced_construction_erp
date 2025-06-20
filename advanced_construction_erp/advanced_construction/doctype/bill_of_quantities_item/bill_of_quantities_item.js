// Copyright (c) 2023, Your Company and contributors
// For license information, please see license.txt

frappe.ui.form.on('Bill of Quantities Item', {
	refresh: function(frm) {
		// Add custom buttons or indicators if needed
	},
	
	quantity: function(frm) {
		// Recalculate amount when quantity changes
		calculate_amount(frm);
	},
	
	rate: function(frm) {
		// Recalculate amount when rate changes
		calculate_amount(frm);
	},
	
	wbs_reference: function(frm) {
		// Fetch details from WBS if reference is provided
		if (frm.doc.wbs_reference) {
			frappe.db.get_value('Work Breakdown Structure', frm.doc.wbs_reference, 
				['description', 'estimated_cost'], function(r) {
				if (r) {
					// Populate fields with WBS data
					if (!frm.doc.description) {
						frm.set_value('description', r.description);
					}
					
					if (!frm.doc.rate && r.estimated_cost) {
						// Suggest the estimated cost as a rate if no rate is set
						frm.set_value('rate', r.estimated_cost);
					}
				}
			});
		}
	}
});

function calculate_amount(frm) {
	if (frm.doc.quantity && frm.doc.rate) {
		let amount = flt(frm.doc.quantity) * flt(frm.doc.rate);
		frm.set_value('amount', amount);
	} else {
		frm.set_value('amount', 0);
	}
}