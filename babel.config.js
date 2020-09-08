module.exports = {
	presets: [['@babel/preset-env']],
	plugins: [
		['@babel/plugin-proposal-nullish-coalescing-operator', { loose: true }],
		['@babel/plugin-proposal-optional-chaining', { loose: true }],
		['@babel/plugin-proposal-class-properties', { loose: true }],
		['module-resolver', { root: ['./'] }],
	],
};
