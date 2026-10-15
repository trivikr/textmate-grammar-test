import { EOL } from 'node:os'
import * as tty from 'node:tty'
import { styleText } from 'node:util'
import type { GrammarTestFile, TestFailure } from '../../unit/types.ts'
import { SYMBOLS } from '../cli'

export interface Reporter {
	reportTestResult(filename: string, testCase: GrammarTestFile, failures: TestFailure[]): void
	reportParseError(filename: string, error: any): void
	reportGrammarTestError(filename: string, testCase: GrammarTestFile, reason: any): void
}

const Padding = '  '

const isatty = tty.isatty(1) && tty.isatty(2)
let terminalWidth = 75

if (isatty) {
	terminalWidth = (process.stdout as tty.WriteStream).getWindowSize()[0]
}

function handleGrammarTestError(filename: string, _testCase: GrammarTestFile, reason: any): void {
	console.log(
		styleText('red', SYMBOLS.err) +
			' testcase ' +
			styleText('gray', filename) +
			' aborted due to an error',
	)
	console.log(reason)
}

function handleParseError(filename: string, error: any): void {
	console.log(
		styleText('red', 'ERROR') + " can't parse testcase: " + styleText('whiteBright', filename) + '',
	)
	console.log(error)
}

abstract class BaseConsoleReporter implements Reporter {
	reportParseError = handleParseError
	reportGrammarTestError = handleGrammarTestError

	abstract reportTestResult(
		filename: string,
		testCase: GrammarTestFile,
		failures: TestFailure[],
	): void

	protected reportSuccess(filename: string): void {
		console.log(
			styleText('green', SYMBOLS.ok) +
				' ' +
				styleText('whiteBright', filename) +
				' run successfuly.',
		)
	}
}

class ConsoleCompactReporter extends BaseConsoleReporter {
	reportTestResult(filename: string, testCase: GrammarTestFile, failures: TestFailure[]): void {
		if (failures.length === 0) {
			this.reportSuccess(filename)
		} else {
			failures.forEach((failure) => {
				console.log(
					`ERROR ${filename}:${failure.line + 1}:${failure.start + 1}:${failure.end + 1} ${this.renderCompactErrorMsg(testCase, failure)}`,
				)
			})
		}
	}

	private renderCompactErrorMsg(_testCase: GrammarTestFile, failure: TestFailure): string {
		let res = ''
		if (failure.missing && failure.missing.length > 0) {
			res += `Missing required scopes: [ ${failure.missing.join(' ')} ] `
		}
		if (failure.unexpected && failure.unexpected.length > 0) {
			res += `Prohibited scopes: [ ${failure.unexpected.join(' ')} ] `
		}
		if (failure.actual !== undefined) {
			res += `actual scopes: [${failure.actual.join(' ')}]`
		}
		return res
	}
}

class ConsoleFullReporter extends BaseConsoleReporter {
	reportTestResult(filename: string, testCase: GrammarTestFile, failures: TestFailure[]): void {
		if (failures.length === 0) {
			this.reportSuccess(filename)
		} else {
			console.log(styleText('red', SYMBOLS.err + ' ' + filename + ' failed'))
			failures.forEach((failure) => {
				printAssertionLocation(filename, failure, Padding, console.log)
				printSourceLine(failure, Padding, terminalWidth, console.log)
				printReason(testCase, failure, Padding, console.log)

				console.log(EOL)
			})
			console.log('')
		}
	}
}

function printAssertionLocation(
	filename: string,
	failure: TestFailure,
	padding: string,
	sink: (message: string) => void,
) {
	const { l, s, e } = getCorrectedOffsets(failure)
	sink(padding + 'at [' + styleText('whiteBright', `${filename}:${l}:${s}:${e}`) + ']:')
}

function getCorrectedOffsets(failure: TestFailure): {
	l: number
	s: number
	e: number
} {
	return {
		l: failure.line + 1,
		s: failure.start + 1,
		e: failure.end + 1,
	}
}

function printSourceLine(
	failure: TestFailure,
	padding: string,
	terminalWidth: number,
	sink: (message: string) => void,
) {
	const pos = failure.line + 1 + ': '
	const accents = ' '.repeat(failure.start) + '^'.repeat(failure.end - failure.start)

	const termWidth = terminalWidth - pos.length - Padding.length - 5

	const trimLeft = failure.end > termWidth ? Math.max(0, failure.start - 8) : 0

	const line1 = failure.srcLineText.slice(trimLeft)
	const accents1 = accents.slice(trimLeft)

	sink(padding + styleText('gray', pos) + line1.slice(0, termWidth))
	sink(padding + ' '.repeat(pos.length) + accents1.slice(0, termWidth))
}

function printReason(
	_testCase: GrammarTestFile,
	failure: TestFailure,
	padding: string,
	sink: (message: string) => void,
) {
	if (failure.missing && failure.missing.length > 0) {
		sink(
			styleText('red', padding + 'missing required scopes: ') +
				styleText('gray', failure.missing.join(' ')),
		)
	}
	if (failure.unexpected && failure.unexpected.length > 0) {
		sink(
			styleText('red', padding + 'prohibited scopes: ') +
				styleText('gray', failure.unexpected.join(' ')),
		)
	}
	if (failure.actual !== undefined) {
		sink(styleText('red', padding + 'actual: ') + styleText('gray', failure.actual.join(' ')))
	}
}

export function createConsoleReporter(compact: boolean) {
	return compact ? new ConsoleCompactReporter() : new ConsoleFullReporter()
}
