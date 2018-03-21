import { TestContext, test } from 'ava'
import { buildSchema, SelectionNode, FieldNode } from 'graphql'
import {
  buildInfoForAllScalars,
  buildInfoFromFragment,
  buildInfoFromSelection,
} from './info'

test('buildInfoForAllScalars: 1 field', t => {
  const schema = buildSchema(`
  type Query {
    book: Book
  }

  type Book {
    title: String
  }
  `)
  const info = buildInfoForAllScalars('book', schema, 'query')
  const selections = info.fieldNodes[0].selectionSet!.selections

  assertFields(t, selections, ['title'])
})

test('buildInfoForAllScalars: 2 fields', t => {
  const schema = buildSchema(`
  type Query {
    book: Book
  }

  type Book {
    title: String
    number: Float
  }
  `)
  const info = buildInfoForAllScalars('book', schema, 'query')
  const selections = info.fieldNodes[0].selectionSet!.selections

  assertFields(t, selections, ['title', 'number'])
  t.is(info.fieldName, 'book')
})

test('buildInfoForAllScalars: excludes object type fields', t => {
  const schema = buildSchema(`
  type Query {
    book: Book
  }

  type Book {
    title: String
    number: Float
    otherBook: Book
  }
  `)
  const info = buildInfoForAllScalars('book', schema, 'query')
  const selections = info.fieldNodes[0].selectionSet!.selections

  assertFields(t, selections, ['title', 'number'])
  t.is(info.fieldName, 'book')
})

test('buildInfoForAllScalars: enums', t => {
  const schema = buildSchema(`
  type Query {
    book: Book
  }

  type Book {
    color: Color
  }

  enum Color { Red, Blue }
  `)
  const info = buildInfoForAllScalars('book', schema, 'query')
  const selections = info.fieldNodes[0].selectionSet!.selections

  assertFields(t, selections, ['color'])
})

test('buildInfoForAllScalars: minimal static root field', t => {
  const schema = buildSchema(`
  type Query {
    count: Int
  }
  `)
  const info = buildInfoForAllScalars('count', schema, 'query')
  t.is(info.fieldNodes.length, 1)
})

test('buildInfoForAllScalars: mutation', t => {
  const schema = buildSchema(`
  type Query {
    book: Int # use name root field name but different type
  }

  type Mutation {
    book: Book
  }

  type Book {
    title: String
  }
  `)
  const info = buildInfoForAllScalars('book', schema, 'mutation')
  const selections = info.fieldNodes[0].selectionSet!.selections

  assertFields(t, selections, ['title'])
})

test('buildInfoForAllScalars: throws error when field not found', t => {
  const schema = buildSchema(`
  type Query {
    count: Int
  }
  `)
  t.throws(() => buildInfoForAllScalars('other', schema, 'query'))
})

test('buildInfoFromFragment: 1 field', t => {
  const schema = buildSchema(`
  type Query {
    book: Book
  }

  type Book {
    title: String
  }
  `)
  const info = buildInfoFromFragment('book', schema, 'query', `{ title }`)
  const selections = info.fieldNodes[0].selectionSet!.selections

  assertFields(t, selections, ['title'])
})

test('buildInfoFromFragment: nested', t => {
  const schema = buildSchema(`
  type Query {
    book: Book
  }

  type Book {
    title: String
    otherBook: Book
  }
  `)
  const fragment = `{ title otherBook { otherBook { title } } }`
  const info = buildInfoFromFragment('book', schema, 'query', fragment)
  const selections = info.fieldNodes[0].selectionSet!.selections as any

  t.is(selections[0].name.value, 'title')
  t.is(selections[1].name.value, 'otherBook')
  t.is(selections[1].selectionSet.selections[0].name.value, 'otherBook')
  t.is(
    selections[1].selectionSet.selections[0].selectionSet.selections[0].name
      .value,
    'title',
  )
})

test('buildInfoFromFragment: invalid selection', t => {
  const schema = buildSchema(`
  type Query {
    book: Book
  }

  type Book {
    title: String
  }
  `)
  t.throws(() => buildInfoFromFragment('book', schema, 'query', `{ xxx }`))
})

test('buildInfoFromFieldSelection: no required fields', t => {
  const schema = buildSchema(`
  type Query {
    book: Book
  }

  type Book {
    title: String
    otherBook: Book
  }
  `)
  const fragment = `{ otherBook { title } }`
  const info = buildInfoFromFragment('book', schema, 'query', fragment)
  const newInfo = buildInfoFromSelection('book', schema, 'query', {
    info,
    field: 'otherBook',
  })
  const selections = newInfo.fieldNodes[0].selectionSet!.selections

  assertFields(t, selections, ['title'])
})

test('buildInfoFromFieldSelection: required fields', t => {
  const schema = buildSchema(`
  type Query {
    book: Book
  }

  type Book {
    id: ID!
    title: String
    otherBook: Book
  }
  `)
  const fragment = `{ otherBook { title } }`
  const info = buildInfoFromFragment('book', schema, 'query', fragment)
  const newInfo = buildInfoFromSelection('book', schema, 'query', {
    info,
    field: 'otherBook',
    required: '{ id otherBook { id } }'
  })
  const selections = newInfo.fieldNodes[0].selectionSet!.selections

  assertFields(t, selections, ['id', 'title', 'otherBook'])
  selections.forEach(s => {
    if (s.kind === 'Field' && s.name.value === 'otherBook') {
      assertFields(t, s.selectionSet!.selections, ['id'])
    }
  })
})

test('buildInfoFromFieldSelection: repeated required fields', t => {
  const schema = buildSchema(`
  type Query {
    book: Book
  }

  type Book {
    id: ID!
    title: String
    otherBook: Book
  }
  `)
  const fragment = `{ otherBook { title otherBook { title } } }`
  const info = buildInfoFromFragment('book', schema, 'query', fragment)
  const newInfo = buildInfoFromSelection('book', schema, 'query', {
    info,
    field: 'otherBook',
    required: '{ id otherBook { id } }'
  })
  const selections = newInfo.fieldNodes[0].selectionSet!.selections

  // There will be one 'otherBook { title }' from the fragment and
  // other 'otherBook { id }' from the requirement. This is valid GraphQL.
  assertFields(t, selections, ['id', 'title', 'otherBook', 'otherBook'])

  // Check if there is an 'id' and a 'title' as selection of 'otherBook'
  const otherBookFields = new Set(
    selections
      .filter(s => s.kind === 'Field' && s.name.value === 'otherBook')
      .map((otherBookField: FieldNode) => otherBookField.selectionSet!.selections)
      .reduce((flat, subSel) => flat.concat(subSel))
      .filter(s => s.kind === 'Field')
      .map((s: FieldNode) => s.name.value)
    )
  t.true(otherBookFields.has('title'))
  t.true(otherBookFields.has('id'))
})

function assertFields(
  t: TestContext,
  selections: SelectionNode[],
  names: string[],
) {
  const fields = names.map<FieldNode>(value => ({
    kind: 'Field',
    name: { kind: 'Name', value },
  }))

  for (const field of fields) {
    t.true(
      selections.some(
        s => s.kind === 'Field' && s.name.value === field.name.value,
      ),
    )
  }

  t.is(selections.length, names.length)
}
