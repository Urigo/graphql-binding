import { GraphQLResolveInfo, GraphQLSchema, InlineFragmentNode } from 'graphql'

export type Operation = 'query' | 'mutation' | 'subscription'

export interface FragmentReplacements {
  [typeName: string]: {
    [fieldName: string]: InlineFragmentNode
  }
}

export interface QueryMap {
  [rootField: string]: (
    args?: { [key: string]: any },
    context?: { [key: string]: any },
    info?: GraphQLResolveInfo | InfoFieldSelection | string,
  ) => Promise<any>
}

export interface SubscriptionMap {
  [rootField: string]: (
    args?: any,
    context?: { [key: string]: any },
    info?: GraphQLResolveInfo | InfoFieldSelection | string,
  ) => AsyncIterator<any> | Promise<AsyncIterator<any>>
}

export interface BindingOptions {
  fragmentReplacements?: FragmentReplacements
  schema: GraphQLSchema
  before?: () => void
  handler?: any
  subscriptionHandler?: any
}

export interface InfoFieldSelection {
  info: GraphQLResolveInfo
  field: string
  required?: string
}
