"""Turning a photo of a menu into structured, consultative feedback.

Overview, pricing notes, description quality, upselling and cross-selling
ideas, missing items, and improvement suggestions - grounded in the actual
items, prices, and descriptions on the menu, not generic restaurant advice.
This is analysis, not marketing copy, so it is deliberately not shaped by
the restaurant's brand voice the way content_generation and content_campaign
are. The package owns the rules for what makes an analysis usable but not
the model that drafts it: callers pass in a ``MenuAnalyzer`` so no AI vendor
is referenced from this layer.
"""
