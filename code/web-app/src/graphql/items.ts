import { gql } from '@apollo/client'

export const ITEMS = gql`
  query ItemsGet {
    items {
      name
      id
    }
  }
`

export const CREATE_ITEM = gql`
  mutation CreateItem($input: NewItem!) {
    createItem(input: $input) {
      name
      id
    }
  }
`

export const REMOVE_ITEM = gql`
  mutation RemoveItem($id: String!) {
    removeItem(id: $id)
  }
`

export const ITEM_CREATED = gql`
  subscription OnItemCreated {
    itemsCreate {
      name
      id
    }
  }
`
