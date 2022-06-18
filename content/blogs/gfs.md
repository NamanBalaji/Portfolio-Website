---
title: "GFS"
date: 2022-06-19T01:24:34+05:30
tags:
  - GFS
  - 6.824
  - Distributed Systems
---

# [The Google File System (2003) - Paper Summary ](https://static.googleusercontent.com/media/research.google.com/en//archive/gfs-sosp2003.pdf)

## Why are we reading the GFS paper?
1. Incorporates many of the recurring themes in Distributed Systems: parallel performance, fault tolerance, replication, consistency.
2. Successful real-world design. BigTable, MapReduce built on top of GFS. 
3. Well-written systems paper - details from the application to the network.

### What were the main contributions of the GFS paper to the industry in 2003?
* Despite writing about basic ideas of distribution, sharding, fault-tolerance, the use of GFS was huge in scale (larger scale than most academic systems).
* Used in industry, and shared about Google’s real-world experience.
* Demonstrated successful use of weak consistency.
* Demonstrated successful use of single master.

### The common trade-offs of Distributed Systems

Here, we present a common tradeoff pattern for distributed systems:
*  To achieve high performance, a common strategy is to shard data over many servers.
* Having many servers lead to constant faults.
* To implement fault tolerance, one strategy is to make use of replication.
* With different replica of the same data, however, potential inconsistencies between each replica will occur.

On the other hand, better consistency usually implies low performance. In GFS, we will see that consistency is traded off for simpler design, greater performance, and high availability.

## What is GFS?

Google File System (GFS) is a scalable distributed file system for large distributed data-intensive applications. It provides fault tolerance even when running on inexpensive commodity hardware, and delivers high average performance to a large number of clients. GFS is widely deployed within Google as a storage platform for applications that require the generation and processing of large data sets.

### What were the problems GFS was trying to solve?

Google needed a large-scale and high-performant unified storage system for many of its internal services such as MapReduce, web crawler services. In particular, this storage system must:

* Be global. Any client can access (read/write) any file. This allows for sharing of data among different applications.
* Support automatic sharding of large files over multiple machines. This improves performance by allowing parallel processes on each file chunk and also deals with large files that cannot fit into a single disk.
* Support automatic recovery from failures.
* Be optimized for sequential access to huge files and for read and append operations which are the most common.

In particular, the authors optimized GFS for high sustained bandwidth (target applications place a premium on processing data in bulk at a high rate), but not necessarily for low latency (GFS is typically used for internal services and is not client-facing).
## The big picture of GFS (Architecture)

GFS consists of a single master and multiple chunkservers and is accessed by multiple clients. Files are divided into fixed-sized chunks of 64MB. Each chunk has an immutable and globally unique chunk handler, which is assigned by the master at the time of chunk creation. By default, each file chunk is replicated on 3 different chunkservers.

![](/images/blog/gfsArchitecture.png)

Figure 1: High level overview of GFS Architecture. Adapted from [1].
### Single Master

The master maintains all the file system metadata. This includes mapping from file to chunks, chunk locations, etc. The master also periodically sends HeartBeat messages to the chunkserver to give it instructions and collect its state (Figure 1).

**Advantage of single master:** Vastly simplify GFS design and the single master can make sophisticated chunk placement and replication decisions using global knowledge.

**Possible disadvantages of single master:**
* Single point of failure. Have to regularly checkpoint critical metadata into non-volatile storage.
* Could be a point of performance bottleneck. Must minimize master involvement in reads and writes.

With regards to Point 2, a client never reads and writes file data through the master. As you can see in Figure 1, a client asks the master which chunkserver it should contact, caches this information for a limited time, and interacts with the chunkserver directly for read and write operations.

### Metadata

Metadata is stored in the master in-memory. This allows master operations to be very fast and also allows the master to efficiently perform periodic scans through its entire state in the background. The periodic scanning is used to implement chunk garbage collection, chunk migration etc.

The master stores 3 major types of metadata:
1. File and chunks namespaces 
2. Filename —> array of chunk handlers
3. Chunk handler —> list of chunk servers, primary chunk server, chunk version number

Note that the first 2 types of metadata are kept persistent by logging mutations to an operation log stored on the master’s local disk, and replicated periodically to remote machines. However, the master does not store the chunk location information persistently. Instead, it asks each chunkserver about its chunks at master startup and whenever a chunkserver joins the cluster. This is because the chunkservers are the authoritative source of data for chunk location and primary status information.

### Consistency Guarantees by GFS

GFS provides a relaxed consistency model, which works well for Google’s highly distributed application but remains relatively simple and efficient to implement. Here, the authors describe two states of a file region (Table 1):
1. A file region is consistent if all clients will always see the same data, despite which replica they read from.
2. A file region is defined if after a mutation it is consistent and the clients will see what the mutation writes in its entirety (i.e. the mutation is written without being interleaved by other data from other mutations).

![](/images/blog/gfsConsistency.png)

Table 1: File Region State after Mutation. Adapted from [1].

When a non-concurrent mutation succeeds (all replicas report success), the file region is defined and thus, consistent. However, in the event of concurrent successful mutations, the file region is consistent but may not be defined: all clients see the same data but typically it consists of interleaved fragments from multiple mutations. A failed mutation (at least 1 replica does not report success) indicates that the file region is not consistent and thus, not defined. In such events of failure, the GFS client simply re-runs the mutation.

#### Atomic operations

GFS provides some atomic guarantees. File namespace mutation (e.g. file creation) is atomic and is handled exclusively by the master. Namespace locking guarantees atomicity, and the master’s operation log defines a global total order of these operations.

In contrast to regular writes or append operation, GFS provides a record append operation that guarantees that the data to be appended is performed at least once atomically even in the presence of concurrent mutations, but at an offset of GFS choosing. GFS will return the offset of the appended data to the client.

#### Chunk replicas

To ensure that after a sequence of successful mutations, the file region contains the data written by the last mutation, GFS i) applies mutation to chunk replicas in the same order by appointing a primary replica and ii) uses chunk version numbers to detect any replica that has become stale because it has missed mutations while its chunkserver was down.

Stale replicas will never be involved in a mutation or given to clients asking the master for chunk locations. They are garbage collected at the earliest opportunity.

## What are the key lessons learned from GFS?

1. Weak consistency may be viable even in production, given that there exists some form of application-level checks.

> GFS clients should rely on record append, instead of overwrites because of the atomic guarantees by record append. Appending is also far more efficient and more resilient to application failures than random writes. Record append’s append-at-least once semantics preserves each writer’s output. Readers can deal with the occasional padding and duplicate records by adding extra information such as checksums and unique identifiers to filter out duplicate records.

> GFS clients also perform checkpointing by atomically renaming the file to a permanent name after writing all data, or checkpointing how much has been successfully written. Checkpoints can also include application-level checksums.

2. Global cluster file system as a universal infrastructure is useful for many data-intensive applications.
3. A single master may be viable if we separate the metadata in the master from the storage in chunkservers, and minimize client calls to master.
4. We can make use of file chunking for parallel throughput.
5. Using a primary replica chunkserver to sequence writes to all replicas.
6. Leases to prevent split-brain chunkserver partitions.

However, there are some shortcomings or not so great areas of GFS from retrospect:
1. Single master performance may not be so great. In restropect, Google started to witness problems when the number of files increased significantly over the years
    
> Going from a few hundred terabytes up to petabytes, and then up to tens of petabytes… that really required a proportionate increase in the amount of metadata the master had to maintain. Also, operations such as scanning the metadata to look for recoveries all scaled linearly with the volume of data. So the amount of work required of the master grew substantially. The amount of storage needed to retain all that information grew as well. [3]

2. There was a lack of automatic fail-over to master replica. Engineers used to have to manually perform load checkpoint of master state and perform failover. This is slow and unproductive.
3. Consistency model may be too relaxed [3].
