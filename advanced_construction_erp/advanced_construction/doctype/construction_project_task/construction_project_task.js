frappe.ui.form.on('Construction Project Task', {
    refresh: function(frm) {
        // Add custom buttons
        if (frm.doc.status !== "Completed") {
            frm.add_custom_button(__('Mark as Completed'), function() {
                frm.set_value('status', 'Completed');
                frm.set_value('progress', 100);
                frm.set_value('actual_end_date', frappe.datetime.get_today());
                frm.save();
            });
        }
        
        if (frm.doc.status === "Not Started") {
            frm.add_custom_button(__('Start Task'), function() {
                frm.set_value('status', 'In Progress');
                frm.set_value('actual_start_date', frappe.datetime.get_today());
                frm.save();
            });
        }
        
        // Add button to view dependencies
        frm.add_custom_button(__('View Dependencies'), function() {
            show_task_dependencies(frm);
        }, __('View'));
        
        // Add button to view Gantt chart
        frm.add_custom_button(__('View Gantt Chart'), function() {
            frappe.route_options = {
                "project": frm.doc.parent
            };
            frappe.set_route("List", "Construction Project Task", "Gantt");
        }, __('View'));
        
        // Show warning if task is on critical path
        if (frm.doc.is_critical_path) {
            frm.dashboard.add_comment(__('This task is on the critical path. Delays will impact project completion.'), 'yellow');
        }
        
        // Show progress indicators
        if (frm.doc.progress) {
            frm.dashboard.add_progress("Progress", frm.doc.progress);
        }
    },
    
    validate: function(frm) {
        // Calculate duration when dates change
        calculate_duration(frm);
    },
    
    start_date: function(frm) {
        calculate_duration(frm);
    },
    
    end_date: function(frm) {
        calculate_duration(frm);
    },
    
    status: function(frm) {
        // Update progress based on status
        if (frm.doc.status === "Completed") {
            frm.set_value('progress', 100);
            if (!frm.doc.actual_end_date) {
                frm.set_value('actual_end_date', frappe.datetime.get_today());
            }
        } else if (frm.doc.status === "Not Started") {
            frm.set_value('progress', 0);
        } else if (frm.doc.status === "In Progress" && !frm.doc.progress) {
            frm.set_value('progress', 10);
            if (!frm.doc.actual_start_date) {
                frm.set_value('actual_start_date', frappe.datetime.get_today());
            }
        }
    },
    
    depends_on: function(frm) {
        validate_dependencies(frm);
    }
});

function calculate_duration(frm) {
    if (frm.doc.start_date && frm.doc.end_date) {
        let start = frappe.datetime.str_to_obj(frm.doc.start_date);
        let end = frappe.datetime.str_to_obj(frm.doc.end_date);
        
        // Calculate difference in days (inclusive of start and end dates)
        let duration = frappe.datetime.get_diff(end, start) + 1;
        frm.set_value('duration', duration);
    }
}

function validate_dependencies(frm) {
    if (!frm.doc.depends_on) return;
    
    let dependencies = frm.doc.depends_on.split(",").map(d => d.trim());
    
    // Check for self-dependency
    if (dependencies.includes(frm.doc.name)) {
        frappe.msgprint(__("Task cannot depend on itself"), __("Invalid Dependency"));
        frm.set_value('depends_on', '');
        return;
    }
}

function show_task_dependencies(frm) {
    // Create a dialog to show task dependencies
    let d = new frappe.ui.Dialog({
        title: __('Task Dependencies'),
        fields: [
            {
                fieldname: 'dependencies_html',
                fieldtype: 'HTML'
            }
        ]
    });
    
    // Fetch dependencies and dependents
    frappe.call({
        method: "frappe.client.get_list",
        args: {
            doctype: "Construction Project Task",
            filters: {
                "parent": frm.doc.parent
            },
            fields: ["name", "task_name", "status", "progress", "start_date", "end_date", "depends_on"]
        },
        callback: function(r) {
            if (r.message) {
                let dependencies = [];
                let dependents = [];
                
                // Find direct dependencies
                if (frm.doc.depends_on) {
                    let deps = frm.doc.depends_on.split(",").map(d => d.trim());
                    dependencies = r.message.filter(task => deps.includes(task.name));
                }
                
                // Find tasks that depend on this task
                dependents = r.message.filter(task => {
                    if (!task.depends_on) return false;
                    let deps = task.depends_on.split(",").map(d => d.trim());
                    return deps.includes(frm.doc.name);
                });
                
                // Generate HTML
                let html = `
                    <div class="dependencies-container">
                        <div class="depends-on">
                            <h5>${__('This task depends on:')}</h5>
                            ${get_task_list_html(dependencies)}
                        </div>
                        <div class="dependents">
                            <h5>${__('Tasks that depend on this task:')}</h5>
                            ${get_task_list_html(dependents)}
                        </div>
                    </div>
                `;
                
                d.fields_dict.dependencies_html.$wrapper.html(html);
            }
        }
    });
    
    d.show();
}

function get_task_list_html(tasks) {
    if (!tasks || !tasks.length) {
        return `<p>${__('None')}</p>`;
    }
    
    let html = '<table class="table table-bordered">';
    html += `
        <thead>
            <tr>
                <th>${__('Task')}</th>
                <th>${__('Status')}</th>
                <th>${__('Progress')}</th>
                <th>${__('Timeline')}</th>
            </tr>
        </thead>
        <tbody>
    `;
    
    tasks.forEach(task => {
        let status_color = task.status === 'Completed' ? 'green' : 
                         task.status === 'In Progress' ? 'orange' : 'red';
        
        html += `
            <tr>
                <td>
                    <a href="#Form/Construction Project Task/${task.name}">${task.task_name}</a>
                </td>
                <td>
                    <span class="indicator ${status_color}">${task.status}</span>
                </td>
                <td>
                    <div class="progress" style="margin-bottom: 0;">
                        <div class="progress-bar" role="progressbar" 
                            style="width: ${task.progress || 0}%;" 
                            aria-valuenow="${task.progress || 0}" 
                            aria-valuemin="0" aria-valuemax="100">
                            ${task.progress || 0}%
                        </div>
                    </div>
                </td>
                <td>
                    ${format_date(task.start_date)} - ${format_date(task.end_date)}
                </td>
            </tr>
        `;
    });
    
    html += '</tbody></table>';
    return html;
}

function format_date(date_str) {
    if (!date_str) return __('Not Set');
    return frappe.datetime.str_to_user(date_str);
}
