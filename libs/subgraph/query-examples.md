# Query examples #

## Query last transactions of a user ##

```graphql
query {
  user(id: "XXXXXXXXXXXXXX") {
    lastTransactions(
      orderBy: timestamp,
      orderDirection: desc,
      where: {
        poolVersion: "3"
      }
    ){
        id #transaction hash
        timestamp 
        inputTokenAmount
        inputTokenAddress
        outputTokenAmount
        outputTokenAddress
    }
  }
}
```

## Query transactions of a user by timestamp range ##

```graphql
query {
  transactions(
    where: {
      userAddress: "XXXXXXXXXXXXXX",
      timestamp_lt: "XXXXXXXXXXXXXX",
      timestamp_gte: "XXXXXXXXXXXXXX",
      poolVersion: "3"
    },
    orderBy: timestamp,
    orderDirection: desc
  ){
      id #transaction hash
      timestamp 
      inputTokenAmount
      inputTokenAddress
      outputTokenAmount
      outputTokenAddress
  }
}
```
