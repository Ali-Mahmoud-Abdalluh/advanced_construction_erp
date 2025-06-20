# -*- coding: utf-8 -*-
# Copyright (c) 2023, Your Company and contributors
# For license information, please see license.txt

from __future__ import unicode_literals
import frappe
from frappe import _
from frappe.model.document import Document
from frappe.utils import getdate, today

class ConstructionSiteSafetyAttachment(Document):
	def validate(self):
		self.validate_attachment()
		self.validate_date()
	
	def validate_attachment(self):
		"""Validate that attachment is provided"""
		if not self.attachment:
			frappe.throw(_("Attachment is required"))
		
		# Check if attachment exists in File doctype
		if not frappe.db.exists("File", {"file_url": self.attachment}):
			frappe.throw(_("Invalid attachment. File does not exist."))
	
	def validate_date(self):
		"""Validate that date is not in the future"""
		if self.date and getdate(self.date) > getdate(today()):
			frappe.throw(_("Date cannot be in the future"))
	
	def get_attachment_url(self):
		"""Return the attachment URL"""
		return self.attachment if self.attachment else None
	
	def get_attachment_info(self):
		"""Return formatted attachment information"""
		attachment_info = {
			"type": self.attachment_type,
			"url": self.attachment,
			"date": self.date
		}
		
		if self.description:
			attachment_info["description"] = self.description
		
		# Get file information
		if self.attachment:
			file_doc = frappe.get_doc("File", {"file_url": self.attachment})
			if file_doc:
				attachment_info["filename"] = file_doc.file_name
				attachment_info["file_size"] = file_doc.file_size
				attachment_info["file_type"] = file_doc.file_type
		
		return attachment_info