// Copyright (c) 2023, Your Company and contributors
// For license information, please see license.txt

frappe.ui.form.on('Construction Material', {
	refresh: function(frm) {
		// Add custom buttons
		frm.add_custom_button(__('Create Item'), function() {
			frm.call({
				doc: frm.doc,
				method: 'create_item',
				callback: function(r) {
					if (r.message) {
						frappe.set_route('Form', 'Item', r.message);
					}
				}
			});
		}, __('Actions'));
		
		// Show/hide fields based on settings
		frm.toggle_display('asset_category', frm.doc.is_fixed_asset);
		
		// Set field properties
		if (frm.doc.item) {
			frm.set_df_property('material_code', 'read_only', 1);
			frm.set_df_property('material_name', 'read_only', 1);
			frm.set_df_property('unit_of_measure', 'read_only', 1);
			
			// Add button to view Item
			frm.add_custom_button(__('View Item'), function() {
				frappe.set_route('Form', 'Item', frm.doc.item);
			}, __('Actions'));
		}
	},
	
	is_fixed_asset: function(frm) {
		// Show/hide asset category field
		frm.toggle_display('asset_category', frm.doc.is_fixed_asset);
		
		// Make asset category mandatory if is_fixed_asset is checked
		frm.toggle_reqd('asset_category', frm.doc.is_fixed_asset);
		
		// If both is_fixed_asset and is_stock_item are checked, uncheck is_stock_item
		if (frm.doc.is_fixed_asset && frm.doc.is_stock_item) {
			frappe.show_alert(__('Fixed assets cannot be stock items. Unchecking "Is Stock Item"'));
			frm.set_value('is_stock_item', 0);
		}
	},
	
	is_stock_item: function(frm) {
		// If both is_fixed_asset and is_stock_item are checked, uncheck is_fixed_asset
		if (frm.doc.is_fixed_asset && frm.doc.is_stock_item) {
			frappe.show_alert(__('Stock items cannot be fixed assets. Unchecking "Is Fixed Asset"'));
			frm.set_value('is_fixed_asset', 0);
		}
	},
	
	material_type: function(frm) {
		// Set default values based on material type
		switch(frm.doc.material_type) {
			case 'Equipment':
			case 'Tool':
				if (!frm.doc.is_fixed_asset) {
					frm.set_value('is_fixed_asset', 1);
				}
				break;
			case 'Raw Material':
			case 'Consumable':
			case 'Finished Good':
			case 'Sub-assembly':
				if (!frm.doc.is_stock_item) {
					frm.set_value('is_stock_item', 1);
				}
				break;
		}
	}
});