// Copyright (c) 2023, Your Company and contributors
// For license information, please see license.txt

frappe.ui.form.on('Work Breakdown Structure', {
	refresh: function(frm) {
		// Add custom buttons
		if (!frm.doc.__islocal) {
			// Add child WBS button
			if (frm.doc.is_group) {
				frm.add_custom_button(__('Add Child WBS'), function() {
					create_child_wbs(frm);
				}, __('Create'));
			}
			
			// Create task button
			if (!frm.doc.is_group && frm.doc.project) {
				frm.add_custom_button(__('Create Task'), function() {
					create_task_from_wbs(frm);
				}, __('Create'));
			}
			
			// View buttons
			frm.add_custom_button(__('WBS Tree'), function() {
				frappe.route_options = {
					parent_wbs: frm.doc.name
				};
				frappe.set_route("Tree", "Work Breakdown Structure");
			}, __('View'));
			
			frm.add_custom_button(__('Gantt Chart'), function() {
				show_gantt_chart(frm);
			}, __('View'));
			
			frm.add_custom_button(__('Cost Breakdown'), function() {
				show_cost_breakdown(frm);
			}, __('View'));
		}
		
		// Show progress indicator
		if (frm.doc.progress) {
			frm.dashboard.add_progress("Progress", frm.doc.progress);
		}
		
		// Show cost variance indicator
		if (frm.doc.cost_variance) {
			let variance_label = frm.doc.cost_variance > 0 ? 
				__('Over Budget: {0}', [format_currency(frm.doc.cost_variance)]) : 
				__('Under Budget: {0}', [format_currency(Math.abs(frm.doc.cost_variance))]);
				
			let indicator_color = frm.doc.cost_variance > 0 ? 'red' : 'green';
			frm.dashboard.add_indicator(variance_label, indicator_color);
		}
		
		// Show linked tasks
		if (frm.doc.project && !frm.doc.is_group) {
			frappe.call({
				method: "get_tasks",
				doc: frm.doc,
				callback: function(r) {
					if (r.message && r.message.length) {
						let tasks_html = '<div class="linked-tasks"><h5>Linked Tasks</h5><ul>';
						r.message.forEach(task => {
							let status_color = task.status === 'Completed' ? 'green' : 
											task.status === 'Working' ? 'orange' : 'red';
							tasks_html += `<li>
								<a href="#Form/Task/${task.name}">${task.subject}</a>
								<span class="indicator ${status_color}">${task.status}</span>
								<div class="small text-muted">
									${format_date(task.expected_start_date)} - ${format_date(task.expected_end_date)}
								</div>
							</li>`;
						});
						tasks_html += '</ul></div>';
						
						$(frm.fields_dict.tasks_html.wrapper).html(tasks_html);
					} else {
						$(frm.fields_dict.tasks_html.wrapper).empty();
					}
				}
			});
		}
	},
	
	validate: function(frm) {
		// Calculate duration
		if (frm.doc.start_date && frm.doc.end_date) {
			let start = frappe.datetime.str_to_obj(frm.doc.start_date);
			let end = frappe.datetime.str_to_obj(frm.doc.end_date);
			
			// Calculate difference in days (inclusive of start and end dates)
			let duration = frappe.datetime.get_diff(end, start) + 1;
			frm.set_value('duration_days', duration);
		}
	},
	
	start_date: function(frm) {
		// Validate start date
		if (frm.doc.start_date && frm.doc.end_date && 
			frappe.datetime.str_to_obj(frm.doc.start_date) > frappe.datetime.str_to_obj(frm.doc.end_date)) {
			frappe.msgprint(__("Start Date cannot be after End Date"));
			frm.set_value('start_date', '');
		} else if (frm.doc.start_date && frm.doc.end_date) {
			// Recalculate duration
			let start = frappe.datetime.str_to_obj(frm.doc.start_date);
			let end = frappe.datetime.str_to_obj(frm.doc.end_date);
			let duration = frappe.datetime.get_diff(end, start) + 1;
			frm.set_value('duration_days', duration);
		}
	},
	
	end_date: function(frm) {
		// Validate end date
		if (frm.doc.start_date && frm.doc.end_date && 
			frappe.datetime.str_to_obj(frm.doc.end_date) < frappe.datetime.str_to_obj(frm.doc.start_date)) {
			frappe.msgprint(__("End Date cannot be before Start Date"));
			frm.set_value('end_date', '');
		} else if (frm.doc.start_date && frm.doc.end_date) {
			// Recalculate duration
			let start = frappe.datetime.str_to_obj(frm.doc.start_date);
			let end = frappe.datetime.str_to_obj(frm.doc.end_date);
			let duration = frappe.datetime.get_diff(end, start) + 1;
			frm.set_value('duration_days', duration);
		}
	},
	
	is_group: function(frm) {
		frm.toggle_reqd('wbs_name', true);
		frm.toggle_reqd('wbs_code', true);
	},
	
	parent_wbs: function(frm) {
		// Validate parent WBS
		if (frm.doc.parent_wbs) {
			frappe.call({
				method: "frappe.client.get",
				args: {
					doctype: "Work Breakdown Structure",
					name: frm.doc.parent_wbs
				},
				callback: function(r) {
					if (r.message) {
						let parent_level = r.message.wbs_level;
						
						if (parent_level >= frm.doc.wbs_level) {
							frappe.msgprint(__("Parent WBS level must be lower than current WBS level"));
							frm.set_value('parent_wbs', '');
						}
					}
				}
			});
		}
	}
});

function create_child_wbs(frm) {
	// Create a new WBS as a child of the current WBS
	frappe.model.open_mapped_doc({
		method: "advanced_construction_erp.advanced_construction_erp.pre_construction.doctype.work_breakdown_structure.work_breakdown_structure.create_child_wbs",
		frm: frm
	});
}

function create_task_from_wbs(frm) {
	// Create a task from this WBS
	frappe.model.open_mapped_doc({
		method: "advanced_construction_erp.advanced_construction_erp.pre_construction.doctype.work_breakdown_structure.work_breakdown_structure.create_task",
		frm: frm
	});
}

function show_gantt_chart(frm) {
	frappe.call({
		method: "get_gantt_data",
		doc: frm.doc,
		callback: function(r) {
			if (r.message) {
				let gantt_data = r.message;
				
				let d = new frappe.ui.Dialog({
					title: __('WBS Gantt Chart'),
					fields: [
						{
							fieldname: 'gantt_html',
							fieldtype: 'HTML'
						}
					],
					size: 'large'
				});
				
				d.fields_dict.gantt_html.$wrapper.html('<div id="wbs-gantt" style="height: 500px;"></div>');
				d.show();
				
				// Initialize Gantt chart
				setTimeout(function() {
					let tasks = prepare_gantt_data(gantt_data);
					
					let gantt = new frappe.Gantt("#wbs-gantt", tasks, {
						view_mode: 'Week',
						on_click: function(task) {
							if (task.id) {
								frappe.set_route("Form", "Work Breakdown Structure", task.id);
							}
						}
					});
				}, 500);
			}
		}
	});
}

function prepare_gantt_data(data) {
	// Convert WBS data to Gantt format
	let tasks = [];
	
	function process_wbs(wbs, parent = null) {
		let task = {
			id: wbs.id,
			name: wbs.name,
			start: wbs.start,
			end: wbs.end,
			progress: wbs.progress / 100,
			dependencies: wbs.dependencies
		};
		
		if (parent) {
			task.parent = parent;
		}
		
		tasks.push(task);
		
		if (wbs.children && wbs.children.length) {
			wbs.children.forEach(child => {
				process_wbs(child, wbs.id);
			});
		}
	}
	
	process_wbs(data);
	return tasks;
}

function show_cost_breakdown(frm) {
	frappe.call({
		method: "get_children",
		doc: frm.doc,
		callback: function(r) {
			if (r.message && r.message.length) {
				let children = r.message;
				
				let d = new frappe.ui.Dialog({
					title: __('Cost Breakdown'),
					fields: [
						{
							fieldname: 'cost_html',
							fieldtype: 'HTML'
						}
					]
				});
				
				let html = '<div class="cost-breakdown">';
				
				// Summary section
				html += `
					<div class="row">
						<div class="col-sm-6">
							<div class="cost-card">
								<h5>${__('Estimated Cost')}</h5>
								<div class="value">${format_currency(frm.doc.estimated_cost)}</div>
							</div>
						</div>
						<div class="col-sm-6">
							<div class="cost-card">
								<h5>${__('Actual Cost')}</h5>
								<div class="value">${format_currency(frm.doc.actual_cost || 0)}</div>
							</div>
						</div>
					</div>
					<div class="row">
						<div class="col-sm-12">
							<div class="cost-card variance">
								<h5>${__('Variance')}</h5>
								<div class="value ${frm.doc.cost_variance > 0 ? 'text-danger' : 'text-success'}">
									${format_currency(frm.doc.cost_variance || 0)}
									(${(frm.doc.cost_variance_percentage || 0).toFixed(2)}%)
								</div>
							</div>
						</div>
					</div>
				`;
				
				// Children breakdown
				html += '<h5 class="mt-4">Cost Breakdown by Component</h5>';
				html += '<table class="table table-bordered">';
				html += `
					<thead>
						<tr>
							<th>${__('WBS Component')}</th>
							<th>${__('Estimated Cost')}</th>
							<th>${__('Actual Cost')}</th>
							<th>${__('Variance')}</th>
						</tr>
					</thead>
					<tbody>
				`;
				
				children.forEach(child => {
					let variance = flt(child.actual_cost || 0) - flt(child.estimated_cost || 0);
					let variance_class = variance > 0 ? 'text-danger' : 'text-success';
					
					html += `
						<tr>
							<td>
								<a href="#Form/Work Breakdown Structure/${child.name}">${child.wbs_name}</a>
								<div class="small text-muted">${child.wbs_code}</div>
							</td>
							<td>${format_currency(child.estimated_cost || 0)}</td>
							<td>${format_currency(child.actual_cost || 0)}</td>
							<td class="${variance_class}">
								${format_currency(variance)}
							</td>
						</tr>
					`;
				});
				
				html += '</tbody></table>';
				
				// Add chart
				html += '<div id="cost-chart" style="height: 300px;"></div>';
				
				html += '</div>';
				html += `
					<style>
						.cost-card {
							border: 1px solid #d1d8dd;
							border-radius: 4px;
							padding: 15px;
							margin-bottom: 15px;
							text-align: center;
						}
						.cost-card h5 {
							margin-top: 0;
							margin-bottom: 10px;
						}
						.cost-card .value {
							font-size: 20px;
							font-weight: bold;
						}
						.cost-card.variance {
							background-color: #f9f9f9;
						}
						.text-danger {
							color: #ff5858;
						}
						.text-success {
							color: #28a745;
						}
					</style>
				`;
				
				d.fields_dict.cost_html.$wrapper.html(html);
				d.show();
				
				// Create chart
				setTimeout(function() {
					new frappe.Chart("#cost-chart", {
						title: __("Cost Breakdown"),
						data: {
							labels: children.map(child => child.wbs_name),
							datasets: [
								{
									name: __("Estimated Cost"),
									values: children.map(child => flt(child.estimated_cost || 0))
								},
								{
									name: __("Actual Cost"),
									values: children.map(child => flt(child.actual_cost || 0))
								}
							]
						},
						type: 'bar',
						colors: ['#7cd6fd', '#ff5858'],
						height: 300
					});
				}, 500);
			} else {
				frappe.msgprint(__("No child WBS components found for cost breakdown"));
			}
		}
	});
}

function format_date(date_str) {
	if (!date_str) return __('Not Set');
	return frappe.datetime.str_to_user(date_str);
}