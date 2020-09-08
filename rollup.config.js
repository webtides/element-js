import babel from 'rollup-plugin-babel';
import nodeResolve from '@rollup/plugin-node-resolve';

module.exports = [
	{
		input: 'index.js',
		plugins: [babel(), nodeResolve()],
		output: {
			interop: false,
			file: 'dist/umd/index.js',
			format: 'umd',
			name: 'ElementJS',
		},
	},
	{
		input: 'index.js',
		plugins: [babel(), nodeResolve()],
		output: {
			interop: false,
			file: 'dist/es/index.js',
			format: 'es',
		},
	},
];
