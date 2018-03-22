import { GraphQLResolveInfo, ExecutionResult, GraphQLSchema } from 'graphql'
import { delegateToSchema } from 'graphql-tools'
import { $$asyncIterator } from 'iterall'
import { FragmentReplacements, InfoFieldSelection } from './types'
import { buildInfo } from './info'

export class Handler<T extends object> implements ProxyHandler<T> {
  constructor(
    private schema: GraphQLSchema,
    private fragmentReplacements: FragmentReplacements,
    private operation: 'query' | 'mutation',
    private before: () => void,
  ) {}

  get(target: T, rootFieldName: string) {
    return (
      args?: { [key: string]: any },
      context?: { [key: string]: any },
      info?: GraphQLResolveInfo | InfoFieldSelection | string,
    ): Promise<ExecutionResult> => {
      this.before()

      const operation = this.operation
      info = buildInfo(rootFieldName, operation, this.schema, info)

      return delegateToSchema(
        this.schema,
        this.fragmentReplacements,
        operation,
        rootFieldName,
        args || {},
        context || {},
        info,
      )
    }
  }
}

export class SubscriptionHandler<T extends object> implements ProxyHandler<T> {
  constructor(
    private schema: GraphQLSchema,
    private fragmentReplacements: FragmentReplacements,
    private before: () => void,
  ) {}

  get(target: T, rootFieldName: string) {
    return async (
      args?: { [key: string]: any },
      context?: { [key: string]: any },
      infoOrQuery?: GraphQLResolveInfo | InfoFieldSelection | string,
    ): Promise<AsyncIterator<any>> => {
      this.before()

      const info = buildInfo(
        rootFieldName,
        'subscription',
        this.schema,
        infoOrQuery,
      )

      const iterator = await delegateToSchema(
        this.schema,
        this.fragmentReplacements,
        'subscription',
        rootFieldName,
        args || {},
        context || {},
        info,
      )

      return {
        async next() {
          const { value } = await iterator.next()
          const data = { [info.fieldName]: value.data[rootFieldName] }
          return { value: data, done: false }
        },
        return() {
          return Promise.resolve({ value: undefined, done: true })
        },
        throw(error) {
          return Promise.reject(error)
        },
        [$$asyncIterator]() {
          return this
        },
      }
    }
  }
}
