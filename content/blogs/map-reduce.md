---
title: "Map Reduce"
date: 2022-06-18T16:48:06+05:30
tags:
  - Map-Reduce
  - 6.824
  - Distributed Systems
---

# [MapReduce: Simplified Data Processing on Large Clusters](https://static.googleusercontent.com/media/research.google.com/en//archive/mapreduce-osdi04.pdf)

MapReduce is a programming model and an associated implementation for processing and generating large data sets. Users specify a _map_ function that processes a key/value pair to generate a set of intermediate key/value pairs, and a _reduce_ function that merges all intermediate values associated with the same intermediate key.

Programs written in this functional style are automatically parallelised and executed on a large cluster of commodity machines. The run-time system takes care of the details of partitioning the input data, scheduling the program's execution across a set of machines, handling machine failures, and managing the required inter-machine communication. This allows programmers without any experience with parallel and distributed systems to easily utilise the resources of a large distributed system.

## What is Map-Reduce?

MapReduce is an interface that enables automatic parallelization and distribution of **large-scale computation**, while **abstracting** over **“the messy details of parallelization, fault-tolerance, data distribution and load balancing” **.

As the name suggests, MapReduce is inspired by map and reduce functions present in many functional languages, which allows them to parallelize large computation easily and use re-execution as a key mechanism to deal with failures.
The abstraction is inspired by the _map_ and _reduce_ primitives present in Lisp and many other functional languages. Map and reduce operations allows easy parallelisation at the same time that re-execution serves as the primary mechanism for fault-tolerance.

## What were the problems MapReduce was trying to solve?

Before MapReduce, Google has implemented hundreds of computations that process a large amount of raw data to compute various derived data.

They found that most of these computations were conceptually straightforward. However, the difficulty comes in the form of large input data whose computation has to be distributed across up to thousands of machines to complete in a reasonable time. Some of these issues that arise with distributed computation are:

1. How to parallelize the computation
2. How to distribute the large input/output data
3. How to handle failures

The main goal of MapReduce is hence to provide an easy-to-us interface even for programmers without experience in distributed and parallel systems by abstracting all the details of parallelization, fault-tolerance, data distribution, and load balancing away.

A benefit that comes with the main goal is that it becomes easier to improve the performance of a computation process by simply adding new machines to the cluster because MapReduce automatically handles all the abstractions for programmers. 

## Architecture
We can express a computation using MapReduce in the form of 2 user-defined functions: Map and Reduce.

`map :=(k1,v1):= (k1, v1):=(k1,v1) —> list(k2,v2)list(k2, v2)list(k2,v2)`
&nbsp;


`reduce :=(k2,list(v2)):= (k2, list(v2)):=(k2,list(v2)) —> list(v3)list(v3)list(v3)`

**Map:** Takes a data input (key, value) pair and produces a set of intermediate (key, value) pairs. The MapReduce library groups together all intermediate values associated with the same intermediate key I and passes them to the Reduce function.

**Reduce:** Accepts an intermediate key and a set of values for that key. It merges these values to form a possibly smaller set of values. Note that the intermediate values are supplied to the reduce function via an iterator. This allows us to handle lists of values that are too large to fit in memory.

Note that in practical use cases, the output from the Reduce operations is often fed as input into another MapReduce job, or possibly another distributed application.

### Overall Execution of MapReduce

![](/images/blog/mapreduce.png)

Figure 1: High level overview of an execution of a MapReduce job. Adapted from [1].

Note that the input data is partitioned into a set of MMM splits. These splits can then be processed in parallel by different machines. The Reduce invocations are also partitioned by the intermediate key space into RRR splits using a user-defined partitioning function. Both MMM and RRR are specified by the user.

Figure 1 shows the overall flow of a MapReduce job. The following sequence of actions will occur when a user calls a MapReduce function (the numbered labels in Figure 1 correspond to the numbers in the list below):

1. Input files are split into MMM pieces typically 16-64MB (Google uses GPS to partition input data automatically) by the user program. It then starts up many copies of the program on a cluster of machines.
2. One of the copies of the program is special – the master. The rest are workers that are assigned work by the master. There are M map tasks and R reduce tasks to assign. The master picks idle workers and assigns each one a map task or a reduce task.
    - Note that in 2004, network bandwidth is a huge bottleneck and the authors wanted to minimise passing data through the network. As described in the Section of Locality Optimisation, the Master tends to schedule map jobs to machines containing the input data (thus, the map jobs are usually run locally).
3. A worker who is assigned a map task reads the contents of the corresponding input split. It parses key/value pairs out of the input data and passes each pair to the user-defined Map function. The intermediate key/value pairs produced by the Map function are buffered in the memory of the map worker.
4. Periodically, the buffered pairs are written to local disk, partitioned into R regions by the partitioning function. The locations of these buffered pairs on the local disk are passed back to the master, who is responsible for forwarding these locations to the reduce workers.
    - Note that reduce jobs only begin after all map jobs are completed (refer to the FAQ Section).
5. When a reduce worker is notified by the master about these locations, it uses remote procedure calls to read the buffered data from the local disks of the map workers. When a reduce worker has read all intermediate data, it sorts it by the intermediate keys so that all occurrences of the same key are grouped together. The sorting is needed because typically many different keys map to the same reduce task. If the amount of intermediate data is too large to fit in memory, an external sort is used.
6. The reduce worker iterates over the sorted intermediate data and for each unique intermediate key encountered, it passes the key and the corresponding set of intermediate values to the user’s Reduce function. The output of the Reduce function is appended to a final output file for this reduce partition.
    - After all map jobs are completed, reduce worker will pull the intermediate data (from a partition) from the local disk of all map workers.
    - Reduce workers will sort the intermediate keys.
    - Pass the intermediate keys in order to Reduce function.
    - Output of Reduce function is appended to a final output file.
7. When all map tasks and reduce tasks have been completed, the master wakes up the user program. At this point, the MapReduce call in the user program returns back to the user code.


### Master data structures

For each map task and reduce task, master stores the state (_idle_, _in-progress_, or _completed_) and the identity of the worker machine.

For each completed map task, the master stores the locations and sizes of the _R_ intermediate file regions produced by the map task. Updates to this location and size information are received as map tasks are compelted. The information is pushed incrementally to workers that have _in-progress_ reduce tasks.

## Fault tolerance

### Worker failure

The master pings every worker periodically. If no response is received from a worker in a certain amount of time, the master marks the worker as failed. Any map tasks completed by the worker are reset back to their initial _idle_ state, and therefore  become eligible for scheduling on other workers. Similarly, any map task or reduce task in progress on a failed worker is also reset to _idle_ and becomes eligible for rescheduling.

Completed map tasks are re-executed on failure because their output is stored on the local disks of the failed machine and is therefore inaccessible. Completed reduce tass do not need to be re-executed since their output is stored in a global file system.

When a map task is executed first by worker _A_, and later executed by worker _B_ (because _A_ failed), all workers executing reduce tasks are notified of the re-execution. Any reduce task that has not already read the data from worker _A_ will read the data from worker _B_.

The MapReduce master simply re-executes the work done by unreachable worker machines and continues to make forward progress.

### Master failure

It's easy to make the master write periodic checkpoints of the master data structures. If the master task dies, a new copy can be started from the last checkpointed state. Current implementation aborts the MapReduce computation if the master fails.

## Refinement

### Partitioning function

Users of MapReduce specify the number of reduce task/output files that they desire (_R_). A default partitioning function is provided that uses hashing (peg: `hash(key) mod R`), which tends to result in fairly well-balanced partitions. In some cases, it is useful to partition data by some other function of the key, for example sometimes the output keys are URLs, and is convenient to have a single host end up in the same output file. A partitioning function can be provided to MapReduce, for example `hash(Hostname(urlkey)) mod R`.

### Ordering guarantees

Within a given partition, the intermediate key/value pairs are guaranteed to be processed in increasing key order, which makes it easy to generate a sorted output file per partition.

### Combiner function

MapReduce allows the user to specify a _Combiner_ function that does partial merging of the data before it is sent over the network.

The _Combiner_ function is executed on each machine that performs a map task. The difference between a reduce function and a combiner function is how the MapReduce library handles the output of the function. The output of a reduce function is written to the final output file. The output of a combiner function is written to an intermediate field that will be sent to a reduce task.

## Usage exmples

* Distributed Grep: The map function emits a line if it matches a supplied pattern. The reduce function is an identity function that just copies the supplied intermediate data to the output.
* Count of URL access frequency: The map function processes logs of a web page requests and outputs `<URL, 1>`. The reduce function adds together all values for the same URL and emits a `<URL, total count>` pair.
* Distributed sort: The map functions extracts the key from each record, and emits a `<key, record>` pair. The reduce function emits all pairs unchanged.

## When is MapReduce not suitable?

1. When you need real-time processing, MapReduce may not be the fastest option.
2. It’s not always very easy to implement each and everything into a sequence of Map and Reduce function.
3. When your intermediate processes need to talk to each other(MapReduce jobs are run in isolation).
4. When you need to handle streaming data.
5. When you can get the desired result in a local machine. “It’s obviously less painful to configure and manage a           standalone system as compared to a distributed system.”

## What are the key lessons from MapReduce?

1. Restricting the programming model makes it easier to parallelize and distribute computations and to even make such computation fault tolerance.
    - E.g. For MapReduce, we restrict the model to accept key/value pairs, and the output also is key/value pair.
2. Redundant executions can be used to reduce the impact of slow machines (stragglers) and to handle machine failures and data loss.
    - In the event of worker failures, MapReduce master simply re-executes the work done by the unreachable worker and continues to make forward progress.
    - Refer to Backup Tasks in Section 3.6 [1] on how MapReduce tackles the issue of “straggler”: a machine that takes an unusually long time to complete one of the last few map or reduce tasks, thus prolong the total time needed. (tldr: the master schedules backup executions on the remaining in-progress tasks when the MapReduce operation is close to completion)


## FAQ

##### 1. Does the shuffle process in Reduce workers (pulling of intermediate data from all map workers) happen concurrently with reduce operations?
&nbsp;
No, it doesn’t. The reduce worker will alternate between shuffling data from map workers, and passing the intermediate data to sort and Reduce function.

##### 2. Do the reduce operations occur concurrently with map operations? No. You can think of the map and reduce operations like occurring in batches. The reduce workers have to wait for all map jobs to be completed to begin working on shuffling, sorting and passing data into Reduce functions.
&nbsp;
This is because MapReduce guarantees ordering, i.e. within a given partition, the intermediate key/value pairs are processed in increasing key order (refer to Section 4.2 of [1]).
In other words, in order for reduce operations to begin, the entire partition must be collected first, then sorted, before the calls to Reduce functions can be made.
The only way to be sure we have the entire partition is to wait for all map operations to be completed so that all input slices have been processed.

