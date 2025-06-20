frappe.ui.form.on('Construction Project', {
    refresh: function(frm) {
        // Add custom buttons
        frm.add_custom_button(__('Create Purchase Order'), function() {
            frappe.model.open_mapped_doc({
                method: 'construction_project.construction_project.doctype.construction_project.construction_project.create_purchase_order',
                frm: frm
            });
        }, __('Create'));

        frm.add_custom_button(__('Create Work Order'), function() {
            frappe.model.open_mapped_doc({
                method: 'construction_project.construction_project.doctype.construction_project.construction_project.create_work_order',
                frm: frm
            });
        }, __('Create'));

        frm.add_custom_button(__('Update Progress'), function() {
            frappe.call({
                method: 'construction_project.construction_project.doctype.construction_project.construction_project.update_project_progress',
                args: {
                    project: frm.doc.name
                },
                callback: function(r) {
                    frm.reload_doc();
                }
            });
        }, __('Actions'));

        frm.add_custom_button(__('Generate Report'), function() {
            frappe.set_route('query-report', 'Construction Project Status', {
                project: frm.doc.name
            });
        }, __('Reports'));
    },

    project: function(frm) {
        if (frm.doc.project) {
            frappe.call({
                method: 'frappe.client.get',
                args: {
                    doctype: 'Project',
                    name: frm.doc.project
                },
                callback: function(r) {
                    if (r.message) {
                        frm.set_value('project_name', r.message.project_name);
                        frm.set_value('project_manager', r.message.project_manager);
                    }
                }
            });
        }
    },

    construction_type: function(frm) {
        if (frm.doc.construction_type) {
            // Clear existing tasks
            frm.clear_table('project_tasks');
            frm.refresh_field('project_tasks');

            // Add default tasks based on construction type
            let default_tasks = [];
            switch(frm.doc.construction_type) {
                case 'Building':
                    default_tasks = [
                        'Site Preparation',
                        'Foundation Work',
                        'Structural Work',
                        'MEP Installation',
                        'Interior Work',
                        'Exterior Work',
                        'Finishing Work'
                    ];
                    break;
                case 'Infrastructure':
                    default_tasks = [
                        'Site Survey',
                        'Earthwork',
                        'Drainage System',
                        'Road Construction',
                        'Utility Installation',
                        'Landscaping'
                    ];
                    break;
                case 'Industrial':
                    default_tasks = [
                        'Site Preparation',
                        'Foundation Work',
                        'Structural Work',
                        'Equipment Installation',
                        'Utility Systems',
                        'Safety Systems'
                    ];
                    break;
                case 'Residential':
                    default_tasks = [
                        'Site Preparation',
                        'Foundation Work',
                        'Structural Work',
                        'Plumbing',
                        'Electrical',
                        'Interior Work',
                        'Landscaping'
                    ];
                    break;
                case 'Commercial':
                    default_tasks = [
                        'Site Preparation',
                        'Foundation Work',
                        'Structural Work',
                        'MEP Installation',
                        'Interior Work',
                        'Exterior Work',
                        'Finishing Work'
                    ];
                    break;
            }

            // Add tasks to the table
            default_tasks.forEach(function(task) {
                let row = frappe.model.add_child(frm.doc, 'Construction Project Task', 'project_tasks');
                row.task_name = task;
                row.status = 'Not Started';
                row.progress = 0;
            });
            frm.refresh_field('project_tasks');
        }
    }
});

// Event handlers for Construction Project Task
frappe.ui.form.on('Construction Project Task', {
    status: function(frm, cdt, cdn) {
        let row = frappe.get_doc(cdt, cdn);
        if (row.status === 'Completed') {
            row.progress = 100;
        } else if (row.status === 'In Progress') {
            if (!row.progress) {
                row.progress = 0;
            }
        } else if (row.status === 'Not Started') {
            row.progress = 0;
        }
        frm.refresh_field('project_tasks');
    }
});

// Event handlers for Construction Project Budget
frappe.ui.form.on('Construction Project Budget', {
    item_code: function(frm, cdt, cdn) {
        let row = frappe.get_doc(cdt, cdn);
        if (row.item_code) {
            frappe.call({
                method: 'frappe.client.get',
                args: {
                    doctype: 'Item',
                    name: row.item_code
                },
                callback: function(r) {
                    if (r.message) {
                        row.item_name = r.message.item_name;
                        if (!row.unit) {
                            row.unit = r.message.stock_uom;
                        }
                        frm.refresh_field('budget_items');
                    }
                }
            });
        }
    },

    quantity: function(frm, cdt, cdn) {
        let row = frappe.get_doc(cdt, cdn);
        if (row.quantity && row.rate) {
            row.amount = row.quantity * row.rate;
            frm.refresh_field('budget_items');
        }
    },

    rate: function(frm, cdt, cdn) {
        let row = frappe.get_doc(cdt, cdn);
        if (row.quantity && row.rate) {
            row.amount = row.quantity * row.rate;
            frm.refresh_field('budget_items');
        }
    }
}); 