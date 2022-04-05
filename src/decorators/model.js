class ReactiveModel {
	controller;

	constructor(controller) {
		if (controller) {
			this.addController(controller);
		}
	}

	addController(controller) {
		this.controller = controller;
		controller.addReactiveModel(this);
	}

	requestUpdate() {
		this.controller.requestUpdate();
	}

	controllerConnected() {}

	controllerDisconnected() {}
}

// Naming...
// Controller?
// lit uses "controller" for this kind of composition. But is it really a controller?!
// a controller is typically known from the MVC Pattern and handles HTTP Requests.
// Mixin?
// a mixin is something that can add properties and methods to a class
// it is not possible to add methods to classes with this pattern.
// Trait?
// traits typically only add behaviours and methods to a class
// Model?
// a model is also known from the MVC Pattern and typically deals with database access...
// but I think the MVC Pattern kind of can be applied here as well.
// The custom element kind of is like a controller with the view layer combined
// the controller configures and manipulates the model, and the model updates the view
function model(options) {
	return (value, context) => {
		if (context.kind === 'field') {
			return function (model) {
				if (!model instanceof ReactiveModel) {
					console.warn(
						`The model "${context.name}" is not a Subclass of "ReactiveModel". Therefore we cannot connect it to the controller to receive automatic lifecycle hooks.`,
					);
					return model;
				}
				model.addController(this);
				this.addReactiveModel(model);
				return model;
			};
		}
	};
}

export { model, ReactiveModel };
