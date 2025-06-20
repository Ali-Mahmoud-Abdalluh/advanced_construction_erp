// Copyright (c) 2023, Your Company and contributors
// For license information, please see license.txt

frappe.ui.form.on('Construction Site Image', {
	refresh: function(frm) {
		// Add custom buttons or indicators if needed
		
		// Show image preview if available
		if (frm.doc.image) {
			frm.sidebar.add_image(frm.doc.image, function() {
				frappe.set_route('Form', 'File', frm.doc.image);
			});
		}
	},
	
	image: function(frm) {
		// When image is uploaded, refresh to show preview
		if (frm.doc.image) {
			frm.trigger('refresh');
			
			// If caption is empty, try to extract filename as caption
			if (!frm.doc.caption) {
				let filename = frm.doc.image.split('/').pop();
				// Remove extension and replace underscores/hyphens with spaces
				filename = filename.split('.').slice(0, -1).join('.');
				filename = filename.replace(/[_-]/g, ' ');
				// Capitalize first letter of each word
				filename = filename.replace(/\w\S*/g, function(txt) {
					return txt.charAt(0).toUpperCase() + txt.substr(1).toLowerCase();
				});
				
				frm.set_value('caption', filename);
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
					message: __('Image Date cannot be in the future')
				});
				frm.set_value('date', today);
			}
		}
	},
	
	image_type: function(frm) {
		// Suggest description based on image type
		if (frm.doc.image_type && !frm.doc.description) {
			let descriptions = {
				'Site Overview': 'General view of the construction site showing overall progress.',
				'Aerial View': 'Aerial perspective of the construction site and surrounding area.',
				'Progress Photo': 'Documentation of construction progress for reporting purposes.',
				'Safety Inspection': 'Image related to safety inspection or safety measures on site.',
				'Quality Control': 'Documentation of quality control check or quality-related issue.',
				'Material Storage': 'View of material storage area or specific materials on site.',
				'Equipment': 'Construction equipment or machinery used on site.',
				'Facility': 'Temporary or permanent facility on the construction site.'
			};
			
			if (descriptions[frm.doc.image_type]) {
				frm.set_value('description', descriptions[frm.doc.image_type]);
			}
		}
	}
});