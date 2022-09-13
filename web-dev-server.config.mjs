// import { fromRollup } from '@web/dev-server-rollup';
// import { babel as rollupBabel } from '@rollup/plugin-babel';

// const babel = fromRollup(rollupBabel);

export default {
	nodeResolve: true,
	watch: true,
	rootDir: './examples',
	plugins: [
		// babel({
		// 	babelHelpers: 'bundled',
		// 	plugins: [
		// 		['@babel/plugin-proposal-decorators', { version: '2021-12' }],
		// 	],
		// }),
	],
};
