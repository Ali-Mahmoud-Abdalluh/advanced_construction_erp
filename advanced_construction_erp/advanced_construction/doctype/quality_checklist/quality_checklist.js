// Copyright (c) 2024, Your Company and contributors
// For license information, please see license.txt

frappe.ui.form.on('Quality Checklist', {
    refresh: function(frm) {
        // Add custom buttons
        if (!frm.doc.__islocal) {
            // Add button to create new version
            if (frm.doc.docstatus === 1 && frm.doc.status !== "Obsolete") {
                frm.add_custom_button(__('Create New Version'), function() {
                    create_new_version(frm);
                }, __('Actions'));
            }
            
            // Add button to create inspection
            if (frm.doc.docstatus === 1 && frm.doc.status === "Active") {
                frm.add_custom_button(__('Create Inspection'), function() {
                    create_inspection(frm);
                }, __('Actions'));
            }
            
            // Add button to sort items
            if (frm.doc.docstatus === 0) {
                frm.add_custom_button(__('Sort Items'), function() {
                    sort_items(frm);
                }, __('Actions'));
            }
        }
        
        // Set defaults
        if (frm.doc.__islocal) {
            frm.set_value('status', 'Draft');
            frm.set_value('version', '1.0');
            frm.set_value('effective_date', frappe.datetime.get_today());
            frm.set_value('created_by', frappe.session.user);
            frm.set_value('creation_date', frappe.datetime.get_today());
        }
        
        // Set field permissions
        if (frm.doc.docstatus === 1) {
            frm.set_df_property('items', 'read_only', 1);
        }
    },
    
    validate: function(frm) {
        // Validate items
        if (!frm.doc.items || frm.doc.items.length === 0) {
            frappe.throw(__("At least one checklist item is required"));
        }
        
        // Ensure all items have sequence numbers
        frm.doc.items.forEach(function(item, index) {
            if (!item.sequence) {
                frappe.model.set_value(item.doctype, item.name, 'sequence', index + 1);
            }
        });
    },
    
    status: function(frm) {
        // When status changes to Active, set approval details
        if (frm.doc.status === 'Active' && !frm.doc.approved_by) {
            frm.set_value('approved_by', frappe.session.user);
            frm.set_value('approval_date', frappe.datetime.get_today());
        }
    }
});

frappe.ui.form.on('Quality Checklist Item', {
    items_add: function(frm, cdt, cdn) {
        // Set sequence number for new item
        let item = locals[cdt][cdn];
        let idx = frm.doc.items.length;
        frappe.model.set_value(cdt, cdn, 'sequence', idx);
    }
});

function create_new_version(frm) {
    frappe.call({
        method: "create_new_version",
        doc: frm.doc,
        callback: function(r) {
            if (r.message) {
                frappe.model.sync(r.message);
                frappe.set_route("Form", r.message.doctype, r.message.name);
                frappe.show_alert({
                    message: __("New version {0} created", [r.message.version]),
                    indicator: 'green'
                });
            }
        }
    });
}

function create_inspection(frm) {
    frappe.call({
        method: "copy_to_inspection",
        doc: frm.doc,
        callback: function(r) {
            if (r.message) {
                frappe.model.sync(r.message);
                frappe.set_route("Form", r.message.doctype, r.message.name);
                frappe.show_alert({
                    message: __("New inspection created"),
                    indicator: 'green'
                });
            }
        }
    });
}

function sort_items(frm) {
    if (!frm.doc.items || frm.doc.items.length === 0) {
        frappe.msgprint(__("No items to sort"));
        return;
    }
    
    // Sort items by sequence
    frm.doc.items.sort(function(a, b) {
        return a.sequence - b.sequence;
    });
    
    // Renumber sequences
    frm.doc.items.forEach(function(item, index) {
        frappe.model.set_value(item.doctype, item.name, 'sequence', index + 1);
    });
    
    frm.refresh_field('items');
    
    frappe.show_alert({
        message: __("Items sorted by sequence"),
        indicator: 'green'
    });
} 