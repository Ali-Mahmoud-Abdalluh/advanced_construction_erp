// Copyright (c) 2023, Your Company and contributors
// For license information, please see license.txt

frappe.ui.form.on('Construction Site Safety Attachment', {
	refresh: function(frm) {
		// Show attachment preview if available
		if (frm.doc.attachment) {
			show_attachment_preview(frm);
		}
		
		// Add custom buttons if needed
		if (frm.doc.attachment) {
			frm.add_custom_button(__('View Attachment'), function() {
				window.open(frm.doc.attachment);
			});
		}
	},
	
	attachment: function(frm) {
		// When attachment is uploaded, show preview
		if (frm.doc.attachment) {
			show_attachment_preview(frm);
			
			// If date is not set, set to today
			if (!frm.doc.date) {
				frm.set_value('date', frappe.datetime.get_today());
			}
			
			// If description is empty and attachment type is set, suggest a description
			if (!frm.doc.description && frm.doc.attachment_type) {
				let descriptions = {
					'Safety Report': 'Safety inspection report document',
					'Incident Report': 'Documentation of safety incident',
					'Safety Certificate': 'Safety compliance certificate',
					'Training Record': 'Safety training documentation',
					'Safety Plan': 'Site safety plan document',
					'Risk Assessment': 'Site risk assessment document',
					'Safety Photo': 'Photographic evidence of safety measures',
					'Other': 'Supporting documentation for safety records'
				};
				
				if (descriptions[frm.doc.attachment_type]) {
					frm.set_value('description', descriptions[frm.doc.attachment_type]);
				}
			}
		}
	},
	
	attachment_type: function(frm) {
		// Suggest description based on attachment type
		if (frm.doc.attachment_type && !frm.doc.description) {
			let descriptions = {
				'Safety Report': 'Safety inspection report document',
				'Incident Report': 'Documentation of safety incident',
				'Safety Certificate': 'Safety compliance certificate',
				'Training Record': 'Safety training documentation',
				'Safety Plan': 'Site safety plan document',
				'Risk Assessment': 'Site risk assessment document',
				'Safety Photo': 'Photographic evidence of safety measures',
				'Other': 'Supporting documentation for safety records'
			};
			
			if (descriptions[frm.doc.attachment_type]) {
				frm.set_value('description', descriptions[frm.doc.attachment_type]);
			}
		}
	},
	
	date: function(frm) {
		// Validate date is not in the future
		if (frm.doc.date) {
			let today = frappe.datetime.get_today();
			if (frm.doc.date > today) {
				frappe.msgprint({
					title: __('Invalid Date'),
					indicator: 'red',
					message: __('Date cannot be in the future')
				});
				frm.set_value('date', today);
			}
		}
	}
});

function show_attachment_preview(frm) {
	if (!frm.doc.attachment) return;
	
	// Get file extension
	let file_url = frm.doc.attachment;
	let file_extension = file_url.split('.').pop().toLowerCase();
	
	// Image extensions
	let image_extensions = ['jpg', 'jpeg', 'png', 'gif', 'bmp', 'svg'];
	
	// PDF extension
	let pdf_extension = 'pdf';
	
	// Clear existing preview
	frm.get_field('attachment').$wrapper.find('.attachment-preview').remove();
	
	// Create preview based on file type
	if (image_extensions.includes(file_extension)) {
		// Image preview
		let $preview = $(`<div class="attachment-preview">
			<img src="${file_url}" style="max-width: 100%; max-height: 300px; margin-top: 10px;">
		</div>`);
		frm.get_field('attachment').$wrapper.append($preview);
	} else if (file_extension === pdf_extension) {
		// PDF preview (link only as embedding might not work well)
		let $preview = $(`<div class="attachment-preview" style="margin-top: 10px;">
			<a href="${file_url}" target="_blank" class="btn btn-sm btn-primary">
				${__('Open PDF')}
			</a>
		</div>`);
		frm.get_field('attachment').$wrapper.append($preview);
	} else {
		// Other file types (just show a download link)
		let filename = file_url.split('/').pop();
		let $preview = $(`<div class="attachment-preview" style="margin-top: 10px;">
			<a href="${file_url}" target="_blank" class="btn btn-sm btn-default">
				${__('Download')}: ${filename}
			</a>
		</div>`);
		frm.get_field('attachment').$wrapper.append($preview);
	}
}