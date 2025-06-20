// Copyright (c) 2023, Your Company and contributors
// For license information, please see license.txt

frappe.ui.form.on('Construction Site', {
	refresh: function(frm) {
		// Add custom buttons
		frm.add_custom_button(__('View on Map'), function() {
			if (frm.doc.latitude && frm.doc.longitude) {
				window.open(`https://www.google.com/maps/search/?api=1&query=${frm.doc.latitude},${frm.doc.longitude}`, '_blank');
			} else if (frm.doc.address) {
				window.open(`https://www.google.com/maps/search/?api=1&query=${encodeURIComponent(frm.doc.address)}`, '_blank');
			} else {
				frappe.msgprint(__('No location information available.'));
			}
		}, __('Actions'));
		
		frm.add_custom_button(__('Site Overview'), function() {
			frappe.call({
				method: 'get_site_overview',
				doc: frm.doc,
				callback: function(r) {
					if (r.message) {
						let overview = r.message;
						let d = new frappe.ui.Dialog({
							title: __('Site Overview: {0}', [frm.doc.site_name]),
							fields: [
								{fieldtype: 'HTML', fieldname: 'overview_html'}
							]
						});
						
						let html = `
							<div class="row">
								<div class="col-sm-6">
									<div class="stat-label">${__('Total Projects')}</div>
									<div class="stat-value">${overview.total_projects}</div>
								</div>
								<div class="col-sm-6">
									<div class="stat-label">${__('Active Projects')}</div>
									<div class="stat-value">${overview.active_projects}</div>
								</div>
							</div>
							<div class="row" style="margin-top: 15px;">
								<div class="col-sm-6">
									<div class="stat-label">${__('Facilities')}</div>
									<div class="stat-value">${overview.total_facilities}</div>
								</div>
								<div class="col-sm-6">
									<div class="stat-label">${__('Documents')}</div>
									<div class="stat-value">${overview.total_documents}</div>
								</div>
							</div>
							<div class="row" style="margin-top: 15px;">
								<div class="col-sm-6">
									<div class="stat-label">${__('Images')}</div>
									<div class="stat-value">${overview.total_images}</div>
								</div>
							</div>
						`;
						
						d.fields_dict.overview_html.$wrapper.html(html);
						d.show();
					}
				}
			});
		}, __('Reports'));
		
		frm.add_custom_button(__('Project Status'), function() {
			frappe.call({
				method: 'get_project_status_summary',
				doc: frm.doc,
				callback: function(r) {
					if (r.message) {
						let status = r.message;
						let d = new frappe.ui.Dialog({
							title: __('Project Status Summary'),
							fields: [
								{fieldtype: 'HTML', fieldname: 'status_html'}
							]
						});
						
						let html = `
							<div class="row">
								<div class="col-sm-6">
									<div class="stat-label">${__('Not Started')}</div>
									<div class="stat-value">${status['Not Started']}</div>
								</div>
								<div class="col-sm-6">
									<div class="stat-label">${__('In Progress')}</div>
									<div class="stat-value">${status['In Progress']}</div>
								</div>
							</div>
							<div class="row" style="margin-top: 15px;">
								<div class="col-sm-6">
									<div class="stat-label">${__('Completed')}</div>
									<div class="stat-value">${status['Completed']}</div>
								</div>
								<div class="col-sm-6">
									<div class="stat-label">${__('On Hold')}</div>
									<div class="stat-value">${status['On Hold']}</div>
								</div>
							</div>
							<div class="row" style="margin-top: 15px;">
								<div class="col-sm-6">
									<div class="stat-label">${__('Cancelled')}</div>
									<div class="stat-value">${status['Cancelled']}</div>
								</div>
							</div>
						`;
						
						d.fields_dict.status_html.$wrapper.html(html);
						d.show();
					}
				}
			});
		}, __('Reports'));
	},
	
	site_name: function(frm) {
		// Update title when site name changes
		if (frm.doc.site_name && frm.doc.city) {
			frm.set_value('title', frm.doc.site_name + ' - ' + frm.doc.city);
		} else if (frm.doc.site_name) {
			frm.set_value('title', frm.doc.site_name);
		}
	},
	
	city: function(frm) {
		// Update title when city changes
		if (frm.doc.site_name && frm.doc.city) {
			frm.set_value('title', frm.doc.site_name + ' - ' + frm.doc.city);
		}
	}
});

// Child table handling for projects
frappe.ui.form.on('Construction Site Project', {
	construction_project: function(frm, cdt, cdn) {
		let row = locals[cdt][cdn];
		if (row.construction_project) {
			frappe.db.get_value('Construction Project', row.construction_project, ['project_name', 'status', 'expected_start_date', 'expected_end_date'], function(r) {
				if (r) {
					frappe.model.set_value(cdt, cdn, 'project_name', r.project_name);
					frappe.model.set_value(cdt, cdn, 'status', r.status);
					frappe.model.set_value(cdt, cdn, 'start_date', r.expected_start_date);
					frappe.model.set_value(cdt, cdn, 'end_date', r.expected_end_date);
				}
			});
		}
	},
	
	project: function(frm, cdt, cdn) {
		let row = locals[cdt][cdn];
		if (row.project) {
			frappe.db.get_value('Project', row.project, ['project_name', 'status', 'expected_start_date', 'expected_end_date'], function(r) {
				if (r) {
					frappe.model.set_value(cdt, cdn, 'project_name', r.project_name);
					frappe.model.set_value(cdt, cdn, 'status', r.status);
					frappe.model.set_value(cdt, cdn, 'start_date', r.expected_start_date);
					frappe.model.set_value(cdt, cdn, 'end_date', r.expected_end_date);
				}
			});
		}
	}
});