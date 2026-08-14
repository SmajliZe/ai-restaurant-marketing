"""Turning a restaurant's profile and a single occasion into a complete
marketing campaign package.

Name, description, offer shape, caption, hashtags, story, CTA, and a
qualitative suggested duration - built together so the pieces read as one
campaign rather than unrelated fragments. The package owns the rules for
what makes a campaign usable (no invented prices, an occasion to build
around) but not the model that drafts it: callers pass in a
``CampaignGenerator`` so no AI vendor is referenced from this layer.
"""
