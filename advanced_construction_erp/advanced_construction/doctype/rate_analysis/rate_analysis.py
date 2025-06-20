import frappe
from frappe import _
from frappe.model.document import Document
from frappe.utils import flt, getdate

class RateAnalysis(Document):
    def validate(self):
        self.validate_dates()
        self.calculate_amounts()
        self.validate_components()
        self.update_market_comparison()

    def validate_dates(self):
        if self.analysis_date and getdate(self.analysis_date) > getdate():
            frappe.throw(_("Analysis Date cannot be in the future"))

    def calculate_amounts(self):
        # Calculate total rate from components
        total_rate = 0
        for component in self.rate_components:
            component.amount = flt(component.quantity) * flt(component.rate)
            total_rate += flt(component.amount)

        self.total_rate = total_rate

        # Calculate waste amount
        self.waste_amount = flt(self.total_rate) * flt(self.waste_percentage) / 100

        # Calculate overhead amount
        self.overhead_amount = flt(self.total_rate) * flt(self.overhead_percentage) / 100

        # Calculate profit amount
        self.profit_amount = flt(self.total_rate) * flt(self.profit_percentage) / 100

        # Calculate final rate
        self.final_rate = (
            flt(self.total_rate) +
            flt(self.waste_amount) +
            flt(self.overhead_amount) +
            flt(self.profit_amount)
        )

    def validate_components(self):
        if not self.rate_components:
            frappe.throw(_("Please add at least one rate component"))

        for component in self.rate_components:
            if not component.item_code:
                frappe.throw(_("Item Code is required for all components"))
            if not component.quantity or flt(component.quantity) <= 0:
                frappe.throw(_("Quantity must be greater than zero"))
            if not component.rate or flt(component.rate) <= 0:
                frappe.throw(_("Rate must be greater than zero"))

    def update_market_comparison(self):
        if not self.market_comparison:
            market_rates = frappe.get_all(
                "Market Rate",
                filters={
                    "item_code": self.item_code,
                    "is_active": 1
                },
                fields=["rate", "supplier", "location", "valid_from"]
            )

            for rate in market_rates:
                self.append("market_comparison", {
                    "rate": rate.rate,
                    "supplier": rate.supplier,
                    "location": rate.location,
                    "valid_from": rate.valid_from
                })

    def on_submit(self):
        self.validate_approval()

    def validate_approval(self):
        if self.status != "Approved":
            frappe.throw(_("Only Approved Rate Analysis can be submitted"))

    def on_cancel(self):
        if self.status == "Approved":
            frappe.throw(_("Approved Rate Analysis cannot be cancelled"))

    @frappe.whitelist()
    def get_item_details(self, item_code):
        """Fetch item details from Item master"""
        if not item_code:
            return

        item = frappe.get_doc("Item", item_code)
        return {
            "item_name": item.item_name,
            "unit": item.stock_uom
        }

    @frappe.whitelist()
    def get_market_rates(self):
        """Get current market rates for the item"""
        if not self.item_code:
            return []

        return frappe.get_all(
            "Market Rate",
            filters={
                "item_code": self.item_code,
                "is_active": 1
            },
            fields=["rate", "supplier", "location", "valid_from"]
        )

    @frappe.whitelist()
    def get_rate_history(self):
        """Get historical rate analysis for the item"""
        if not self.item_code:
            return []

        return frappe.get_all(
            "Rate Analysis",
            filters={
                "item_code": self.item_code,
                "status": "Approved"
            },
            fields=["analysis_date", "final_rate", "status"],
            order_by="analysis_date desc"
        )

    @frappe.whitelist()
    def get_rate_trend(self):
        """Get rate trend analysis for the item"""
        if not self.item_code:
            return []

        # Get approved rate analysis
        rate_analysis = frappe.get_all(
            "Rate Analysis",
            filters={
                "item_code": self.item_code,
                "status": "Approved"
            },
            fields=["analysis_date", "final_rate"],
            order_by="analysis_date"
        )

        # Get market rates
        market_rates = frappe.get_all(
            "Market Rate",
            filters={
                "item_code": self.item_code,
                "is_active": 1
            },
            fields=["valid_from", "rate"],
            order_by="valid_from"
        )

        return {
            "rate_analysis": rate_analysis,
            "market_rates": market_rates
        } 