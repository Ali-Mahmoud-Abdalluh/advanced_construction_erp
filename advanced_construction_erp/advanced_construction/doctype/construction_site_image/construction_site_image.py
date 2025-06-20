# -*- coding: utf-8 -*-
# Copyright (c) 2023, Your Company and contributors
# For license information, please see license.txt

from __future__ import unicode_literals
import frappe
from frappe import _
from frappe.model.document import Document
from frappe.utils import getdate, today

class ConstructionSiteImage(Document):
	def validate(self):
		self.validate_date()
		self.validate_image()
	
	def validate_date(self):
		"""Validate that image date is not in the future"""
		if self.date and getdate(self.date) > getdate(today()):
			frappe.throw(_("Image Date cannot be in the future"))
	
	def validate_image(self):
		"""Validate that image is attached"""
		if not self.image:
			frappe.throw(_("Image attachment is required"))
	
	def get_image_url(self):
		"""Return the URL for the attached image"""
		if self.image:
			return self.image
		return None
	
	def get_image_info(self):
		"""Return formatted image information"""
		info = {
			"type": self.image_type,
			"date": self.date,
			"url": self.get_image_url()
		}
		
		if self.caption:
			info["caption"] = self.caption
		
		if self.description:
			info["description"] = self.description
		
		return info