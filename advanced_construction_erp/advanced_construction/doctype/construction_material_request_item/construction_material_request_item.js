// Copyright (c) 2023, Your Company and contributors
// For license information, please see license.txt

frappe.ui.form.on('Construction Material Request Item', {
	refresh: function(frm) {
		// Add custom buttons or indicators if needed
	},
	
	construction_material: function(frm) {
		// Fetch details from Construction Material
		if (frm.doc.construction_material) {
			// Clear item_code if construction_material is selected
			if (frm.doc.item_code) {
				frm.set_value('item_code', '');
			}
			
			frappe.db.get_value('Construction Material', frm.doc.construction_material, 
				['material_name', 'material_description', 'unit_of_measure', 'standard_rate'], function(r) {
				if (r) {
					if (!frm.doc.description) {
						frm.set_value('description', r.material_name || r.material_description);
					}
					
					if (!frm.doc.uom) {
						frm.set_value('uom', r.unit_of_measure);
					}
					
					if (!frm.doc.estimated_price && r.standard_rate) {
						frm.set_value('estimated_price', r.standard_rate);
						calculate_amount(frm);
					}
				}
			});
		}
	},
	
	item_code: function(frm) {
		// Fetch details from Item
		if (frm.doc.item_code) {
			// Clear construction_material if item_code is selected
			if (frm.doc.construction_material) {
				frm.set_value('construction_material', '');
			}
			
			frappe.db.get_value('Item', frm.doc.item_code, 
				['item_name', 'description', 'stock_uom', 'standard_rate'], function(r) {
				if (r) {
					if (!frm.doc.description) {
						frm.set_value('description', r.description || r.item_name);
					}
					
					if (!frm.doc.uom) {
						frm.set_value('uom', r.stock_uom);
					}
					
					if (!frm.doc.estimated_price && r.standard_rate) {
						frm.set_value('estimated_price', r.standard_rate);
						calculate_amount(frm);
					}
				}
			});
		}
	},
	
	quantity: function(frm) {
		// Recalculate amount when quantity changes
		calculate_amount(frm);
		
		// Notify parent form to recalculate totals
		if (frm.doc.parent) {
			frappe.model.trigger(frm.doc.parenttype, 'items');
		}
	},
	
	estimated_price: function(frm) {
		// Recalculate amount when estimated price changes
		calculate_amount(frm);
		
		// Notify parent form to recalculate totals
		if (frm.doc.parent) {
			frappe.model.trigger(frm.doc.parenttype, 'items');
		}
	}
});

function calculate_amount(frm) {
	if (frm.doc.quantity && frm.doc.estimated_price) {
		let amount = flt(frm.doc.quantity) * flt(frm.doc.estimated_price);
		frm.set_value('estimated_amount', amount);
	} else {
		frm.set_value('estimated_amount', 0);
	}
}