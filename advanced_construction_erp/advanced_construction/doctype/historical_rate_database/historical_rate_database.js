frappe.ui.form.on('Historical Rate Database', {
    refresh: function(frm) {
        // Add custom buttons
        frm.add_custom_button(__('Add Rate History'), function() {
            add_rate_history(frm);
        });
        
        frm.add_custom_button(__('Add Project Reference'), function() {
            add_project_reference(frm);
        });
        
        frm.add_custom_button(__('Calculate Indexed Rate'), function() {
            calculate_indexed_rate(frm);
        });
        
        // Add chart for rate history
        if(frm.doc.rate_history && frm.doc.rate_history.length > 0) {
            render_rate_history_chart(frm);
        }
    },
    
    onload: function(frm) {
        // Set up filter for project field in project references
        frm.set_query('project', 'projects', function() {
            return {
                filters: {
                    'docstatus': 1
                }
            };
        });
    },
    
    validate: function(frm) {
        // Add custom validation if needed
    }
});

// Helper function to add rate history
function add_rate_history(frm) {
    let d = new frappe.ui.Dialog({
        title: __('Add Rate History'),
        fields: [
            {
                label: __('Rate Date'),
                fieldname: 'rate_date',
                fieldtype: 'Date',
                reqd: 1,
                default: frappe.datetime.get_today()
            },
            {
                label: __('Rate'),
                fieldname: 'rate',
                fieldtype: 'Currency',
                reqd: 1,
                default: frm.doc.current_rate
            },
            {
                label: __('Index Value'),
                fieldname: 'index_value',
                fieldtype: 'Float'
            },
            {
                label: __('Source'),
                fieldname: 'source',
                fieldtype: 'Data'
            },
            {
                label: __('Notes'),
                fieldname: 'notes',
                fieldtype: 'Text'
            }
        ],
        primary_action_label: __('Add'),
        primary_action: function() {
            let values = d.get_values();
            
            frappe.call({
                method: 'advanced_construction_erp.construction_estimation.doctype.historical_rate_database.historical_rate_database.add_rate_history',
                args: {
                    'item_code': frm.doc.item_code,
                    'rate': values.rate,
                    'rate_date': values.rate_date,
                    'index_value': values.index_value,
                    'source': values.source,
                    'notes': values.notes
                },
                callback: function(r) {
                    frm.refresh();
                    d.hide();
                }
            });
        }
    });
    
    d.show();
}

// Helper function to add project reference
function add_project_reference(frm) {
    let d = new frappe.ui.Dialog({
        title: __('Add Project Reference'),
        fields: [
            {
                label: __('Project'),
                fieldname: 'project',
                fieldtype: 'Link',
                options: 'Construction Project',
                reqd: 1
            },
            {
                label: __('Rate Used'),
                fieldname: 'rate_used',
                fieldtype: 'Currency',
                default: frm.doc.current_rate
            },
            {
                label: __('Usage Date'),
                fieldname: 'usage_date',
                fieldtype: 'Date',
                default: frappe.datetime.get_today()
            },
            {
                label: __('Location'),
                fieldname: 'location',
                fieldtype: 'Data'
            },
            {
                label: __('Notes'),
                fieldname: 'notes',
                fieldtype: 'Text'
            }
        ],
        primary_action_label: __('Add'),
        primary_action: function() {
            let values = d.get_values();
            
            // Add project reference
            frm.call({
                doc: frm.doc,
                method: 'add_project_reference',
                args: {
                    'project': values.project,
                    'rate_used': values.rate_used,
                    'usage_date': values.usage_date,
                    'location': values.location,
                    'notes': values.notes
                },
                callback: function(r) {
                    frm.refresh();
                    d.hide();
                }
            });
        }
    });
    
    d.show();
}

// Helper function to calculate indexed rate
function calculate_indexed_rate(frm) {
    if(!frm.doc.base_index || !frm.doc.base_index_date) {
        frappe.msgprint(__('Base index and date must be set for indexation'));
        return;
    }
    
    let d = new frappe.ui.Dialog({
        title: __('Calculate Indexed Rate'),
        fields: [
            {
                label: __('Use Current Index'),
                fieldname: 'use_current_index',
                fieldtype: 'Check',
                default: 1,
                onchange: function() {
                    let use_current = d.get_value('use_current_index');
                    d.set_df_property('target_index', 'reqd', !use_current);
                    d.set_df_property('target_date', 'reqd', !use_current);
                    d.set_df_property('target_index', 'read_only', use_current);
                    d.set_df_property('target_date', 'read_only', use_current);
                    
                    if(use_current) {
                        d.set_value('target_index', frm.doc.current_index);
                        d.set_value('target_date', frm.doc.current_index_date);
                    }
                }
            },
            {
                label: __('Target Index'),
                fieldname: 'target_index',
                fieldtype: 'Float',
                default: frm.doc.current_index,
                read_only: 1
            },
            {
                label: __('Target Date'),
                fieldname: 'target_date',
                fieldtype: 'Date',
                default: frm.doc.current_index_date,
                read_only: 1
            }
        ],
        primary_action_label: __('Calculate'),
        primary_action: function() {
            let values = d.get_values();
            
            frappe.call({
                method: 'advanced_construction_erp.construction_estimation.doctype.historical_rate_database.historical_rate_database.calculate_indexed_rate',
                args: {
                    'item_code': frm.doc.item_code,
                    'target_index': values.use_current_index ? null : values.target_index,
                    'target_date': values.use_current_index ? null : values.target_date
                },
                callback: function(r) {
                    if(r.message) {
                        let result = r.message;
                        let d2 = new frappe.ui.Dialog({
                            title: __('Indexed Rate Result'),
                            fields: [
                                {
                                    label: __('Original Rate'),
                                    fieldname: 'original_rate',
                                    fieldtype: 'Currency',
                                    default: result.original_rate,
                                    read_only: 1
                                },
                                {
                                    label: __('Original Date'),
                                    fieldname: 'original_date',
                                    fieldtype: 'Date',
                                    default: result.original_date,
                                    read_only: 1
                                },
                                {
                                    label: __('Indexed Rate'),
                                    fieldname: 'indexed_rate',
                                    fieldtype: 'Currency',
                                    default: result.indexed_rate,
                                    read_only: 1
                                },
                                {
                                    label: __('Indexed Date'),
                                    fieldname: 'indexed_date',
                                    fieldtype: 'Date',
                                    default: result.indexed_date,
                                    read_only: 1
                                },
                                {
                                    label: __('Base Index'),
                                    fieldname: 'base_index',
                                    fieldtype: 'Float',
                                    default: result.base_index,
                                    read_only: 1
                                },
                                {
                                    label: __('Target Index'),
                                    fieldname: 'target_index',
                                    fieldtype: 'Float',
                                    default: result.target_index,
                                    read_only: 1
                                },
                                {
                                    label: __('Index Factor'),
                                    fieldname: 'index_factor',
                                    fieldtype: 'Float',
                                    default: result.target_index / result.base_index,
                                    read_only: 1
                                }
                            ],
                            primary_action_label: __('Close'),
                            primary_action: function() {
                                d2.hide();
                            }
                        });
                        
                        d2.show();
                    }
                    
                    d.hide();
                }
            });
        }
    });
    
    d.show();
}

// Function to render rate history chart
function render_rate_history_chart(frm) {
    if(!frm.doc.rate_history || frm.doc.rate_history.length <= 1) {
        return;
    }
    
    // Sort rate history by date
    let rate_history = frm.doc.rate_history.slice().sort(function(a, b) {
        return new Date(a.rate_date) - new Date(b.rate_date);
    });
    
    // Prepare data for chart
    let dates = [];
    let rates = [];
    let indices = [];
    let has_indices = false;
    
    for(let i = 0; i < rate_history.length; i++) {
        let record = rate_history[i];
        dates.push(record.rate_date);
        rates.push(record.rate);
        indices.push(record.index_value);
        
        if(record.index_value) {
            has_indices = true;
        }
    }
    
    // Chart data
    let chart_data = {
        labels: dates,
        datasets: [
            {
                name: __('Rate'),
                values: rates,
                chartType: 'line'
            }
        ]
    };
    
    // Add index dataset if available
    if(has_indices) {
        chart_data.datasets.push({
            name: __('Index'),
            values: indices,
            chartType: 'line',
            yAxisIndex: 1
        });
    }
    
    // Render chart
    let chart_options = {
        title: __('Rate History'),
        type: 'axis-mixed',
        height: 300,
        colors: ['#4e73df', '#1cc88a'],
        axisOptions: {
            xAxisMode: 'tick',
            xIsSeries: true
        },
        tooltipOptions: {
            formatTooltipY: value => format_currency(value)
        }
    };
    
    frm.dashboard.render_chart(chart_data, chart_options);
} 