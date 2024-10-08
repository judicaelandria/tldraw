'use client'

import { cn } from '@/utils/cn'
import { LinkIcon } from '@heroicons/react/20/solid'
import { getOwnProperty } from '@tldraw/utils'
import {
	ReactElement,
	ReactNode,
	cloneElement,
	createContext,
	isValidElement,
	useContext,
	useMemo,
} from 'react'
import { A } from './a'

const CodeLinksContext = createContext<Record<string, string>>({})

export function CodeLinks({
	children,
	links,
}: {
	children: React.ReactNode
	links: Record<string, string>
}) {
	return <CodeLinksContext.Provider value={links}>{children}</CodeLinksContext.Provider>
}

const FocusLinesContext = createContext<null | number[]>(null)
export function FocusLines({ children, lines }: { children: ReactNode; lines: number[] }) {
	return <FocusLinesContext.Provider value={lines}>{children}</FocusLinesContext.Provider>
}

const blurredLineClassName = 'opacity-50 !text-white'

function CodeLink({ children, href }: { children: ReactNode; href: string }) {
	return (
		<A href={href} className="group-[.not-prose]:hover:underline">
			<LinkIcon className="h-3.5 mb-1 mr-0.5 inline-block" />
			{children}
		</A>
	)
}

export function Code({ children, ...props }: React.ComponentProps<'code'>) {
	const codeLinks = useContext(CodeLinksContext)
	const focusLines = useContext(FocusLinesContext)

	const newChildren = useMemo(() => {
		// to linkify code, we have to do quite a lot of work. we need to take the output of
		// Highlight.js and transform it to add hyperlinks to certain tokens. There are a few things
		// that make this difficult:
		//
		// 1, the structure is recursive. A function span will include a bunch of other spans making
		// up the whole definition of the function, for example.
		//
		// 2, a given span doesn't necessarily correspond to a single identifier. For example, this
		// code: `dispatch: (info: TLEventInfo) => this` will be split like this:
		// - `dispatch`
		// - `: (info: TLEventInfo) => `
		// - `this`
		//
		// That means we need to take highlight.js's tokens and split them into our own tokens that
		// contain single identifiers to linkify.
		//
		// 3, a single identifier can be split across multiple spans. For example,
		// `Omit<Geometry2dOptions>` will be split like this:
		// - `Omit`
		// - `<`
		// - `Geometry2`
		// - `dOptions`
		// - `>`
		//
		// I don't know why this happens, it feels like a bug. We handle this by keeping track of &
		// merging consecutive tokens if they're identifiers with no non-identifier tokens in
		// between.

		// does this token look like a JS identifier?
		function isIdentifier(token: string): boolean {
			return /^[_$a-zA-Z\xA0-\uFFFF][_$a-zA-Z0-9\xA0-\uFFFF]*$/g.test(token)
		}

		// split the code into an array of identifiers, and the bits in between them
		function tokenize(code: string): string[] {
			const identifierRegex = /[_$a-zA-Z\xA0-\uFFFF][_$a-zA-Z0-9\xA0-\uFFFF]*/g

			let currentIdx = 0
			const tokens = []
			for (const identifierMatch of code.matchAll(identifierRegex)) {
				const [identifier] = identifierMatch
				const idx = identifierMatch.index
				if (idx > currentIdx) {
					tokens.push(code.slice(currentIdx, idx))
				}
				tokens.push(identifier)
				currentIdx = idx + identifier.length
			}
			if (currentIdx < code.length) {
				tokens.push(code.slice(currentIdx))
			}

			return tokens
		}

		// what line are we on?
		let lineNumber = 1

		// recursively process the children array
		function processChildrenArray(children: ReactNode): ReactNode {
			if (!Array.isArray(children)) {
				if (!children) return children
				return processChildrenArray([children])
			}

			// these are the new linkified children, the result of this function
			const newChildren = []

			// in order to deal with token splitting/merging, we need to keep track of the last
			// highlight span we saw. this has the right classes on it to colorize the current
			// token.
			let lastSeenHighlightSpan: ReactElement | null = null
			// the current identifier that we're building up by merging consecutive tokens
			let currentIdentifier: string | null = null
			// whether the current span is closed, but we're still in the same identifier and might
			// still need to append to it
			let isCurrentSpanClosed = false

			function startSpan(span: ReactElement) {
				lastSeenHighlightSpan = span
				isCurrentSpanClosed = false
			}

			function closeSpan() {
				isCurrentSpanClosed = true
				if (!currentIdentifier) {
					lastSeenHighlightSpan = null
				}
			}

			function pushInCurrentSpan(content: ReactNode) {
				const isLineInFocus = focusLines ? focusLines.includes(lineNumber) : true
				const lineProps = {
					'data-line': lineNumber,
					className: cn(
						lastSeenHighlightSpan?.props.className,
						isLineInFocus ? '' : blurredLineClassName
					),
				}

				if (lastSeenHighlightSpan) {
					newChildren.push(
						cloneElement(lastSeenHighlightSpan, {
							key: newChildren.length,
							children: content,
							...lineProps,
						})
					)
				} else {
					newChildren.push(
						<span key={newChildren.length} {...lineProps}>
							{content}
						</span>
					)
				}
			}

			function finishCurrentIdentifier() {
				if (currentIdentifier) {
					const link = getOwnProperty(codeLinks, currentIdentifier)
					if (link) {
						pushInCurrentSpan(<CodeLink href={link}>{currentIdentifier}</CodeLink>)
					} else {
						pushInCurrentSpan(currentIdentifier)
					}
					currentIdentifier = null
				}
				if (isCurrentSpanClosed) {
					lastSeenHighlightSpan = null
				}
			}

			function pushToken(token: string) {
				if (isIdentifier(token)) {
					if (currentIdentifier) {
						currentIdentifier += token
					} else {
						currentIdentifier = token
					}
				} else {
					finishCurrentIdentifier()

					const lineParts = token.split('\n')
					for (let i = 0; i < lineParts.length; i++) {
						let part = lineParts[i]
						if (i > 0) {
							lineNumber += 1
							part = '\n' + part
						}
						pushInCurrentSpan(part)
					}
				}
			}

			for (const child of children) {
				if (typeof child === 'string') {
					for (const token of tokenize(child)) {
						pushToken(token)
					}
				} else if (isValidElement<{ children: ReactNode }>(child)) {
					if (child.type === 'span' && typeof child.props.children === 'string') {
						startSpan(child)
						for (const token of tokenize(child.props.children)) {
							pushToken(token)
						}
						closeSpan()
					} else {
						finishCurrentIdentifier()
						newChildren.push(
							cloneElement(child, {
								key: newChildren.length,
								children: processChildrenArray(child.props.children),
							})
						)
					}
				} else {
					throw new Error(`Invalid code child: ${JSON.stringify(child)}`)
				}
			}

			finishCurrentIdentifier()

			return newChildren
		}

		return processChildrenArray(children)
	}, [children, codeLinks, focusLines])

	return <code {...props}>{newChildren}</code>
}
