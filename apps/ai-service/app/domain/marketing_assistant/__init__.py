"""A persistent, multi-turn marketing conversation for a restaurant.

Answers grounded in the restaurant's actual recent activity - what it has
generated, planned, run as a campaign, or learned from its own menu - rather
than generic marketing advice. Unlike content_generation and content_calendar
this owns no schema for what the model must return: a chat reply is free
text, not a rigid object, so the package's own rule is only that a reply
exists at all. The package owns the rules for what makes a reply usable but
not the model that drafts it: callers pass in a ``MarketingAssistant`` so no
AI vendor is referenced from this layer.
"""
