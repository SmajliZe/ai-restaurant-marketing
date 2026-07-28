"""Turning a photo of a dish into publishable Instagram copy.

The package owns the rules (what makes a caption acceptable, what counts as a
usable image) but not the model that produces it: callers pass in a
``CaptionGenerator`` so no AI vendor is referenced from this layer.
"""
