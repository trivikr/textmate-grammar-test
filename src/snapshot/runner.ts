import fs from 'node:fs'
import path from 'node:path'
import { styleText } from 'node:util'
import type tm from 'vscode-textmate'
import { ExitCode, SYMBOLS } from '../common/cli/index.ts'
import { getVSCodeTokens, renderSnapshot } from './index.ts'

export interface SnapshotOptions {
	updateSnapshot: boolean
	outdir: string
}

export class SnapshotRunner {
	constructor(
		private registry: tm.Registry,
		private filenameToScope: (filename: string) => string,
	) {}

	async run(testFile: string, options: SnapshotOptions): Promise<ExitCode> {
		const src = fs.readFileSync(testFile, 'utf-8')
		const scope = this.filenameToScope(path.basename(testFile))
		if (scope.length === 0) {
			console.log(styleText('red', 'ERROR') + " can't run testcase: " + testFile)
			console.log(
				'No scope is associated with the file. Specify with --scope, or add it to your package.json.',
			)
			return ExitCode.Failure
		}

		const tokens = await getVSCodeTokens(this.registry, scope, src)
		const out_name =
			options.outdir.length > 0 ? path.join(options.outdir, path.basename(testFile)) : testFile
		const out_file = out_name + '.snap'

		const actual = renderSnapshot(tokens, scope)

		if (fs.existsSync(out_file)) {
			if (options.updateSnapshot) {
				console.log(
					styleText('yellowBright', 'Updating snapshot for ') + styleText('whiteBright', out_file),
				)
				fs.writeFileSync(out_file, actual, 'utf-8')
				return ExitCode.Success
			}

			const expected = fs.readFileSync(out_file, 'utf-8')
			if (actual === expected) {
				console.log(
					styleText('green', SYMBOLS.ok) +
						' ' +
						styleText('whiteBright', testFile) +
						' run successfully.',
				)
				return ExitCode.Success
			}

			console.log(
				styleText('red', SYMBOLS.err) +
					' ' +
					styleText('whiteBright', testFile) +
					' snapshot mismatch. Run with -u to update or check git diff.',
			)
			return ExitCode.Failure
		}

		console.log(
			styleText('yellowBright', 'Generating snapshot ') + styleText('whiteBright', out_file),
		)
		fs.writeFileSync(out_file, actual, 'utf-8')
		return ExitCode.Success
	}
}
