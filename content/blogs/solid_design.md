---
title: "SOLID Design Principles"
date: 2022-07-20T20:16:20+05:30
tags:
  - SOLID
  - Go
  - Design pattern
---

We want to design and write software that is **well engineered**, **decoupled**, **reusable**, and **responsive to changing requirements**.
Obviously, we want to avoide writing bad code. But what exactly is bad code ? Following are some of the properties of bad code :
- **Rigid**: Is the code rigid? Does it have a straight jacket of overbearing types and parameters, that making modification difficult?
- **Fragile**: Is the code fragile? Does the slightest change ripple through the code base causing untold havoc?
- **Immobile**: Is the code hard to refactor? Is it one keystroke away from an import loop?
- **Complex**: Is there code for the sake of having code, are things over-engineered?
- **Verbose**: Is it just exhausting to use the code? When you look at it, can you even tell what this code is trying to do?

# Solid Principles
In 2002 Robert Martin aka **Uncle Bob** published his book, Agile Software Development, Principles, Patterns, and Practices. In it he described five principles of reusable software design, which he called the SOLID principles, after the first letters in their names.

- **Single Responsibility Principle**
- **Open/Closed Principle**
- **Liskov Substitution Principle**
- **Interface Segregation Principle**
- **Dependency Inversion Principle**

These five principles help us understand the need for certain design patterns and software architecture in general. 

## The Single Responsiblity Principle

The Single Responsibility Principle states that **a class should do one thing and therefore it should have only a single reason to change.**

Let's say I have a **Class** in-charge of two duties , once there is a requirement change that leads to modification in the logic/code of one of the responsibilities, it is possible that it causes the function of another responsibility to fail.

In this article I have used **Golang** and there are no classes in the language but the concept of SRP still applies to **packages**, **structs**, **functions** and **methods**.

### Common Pitfalls and Anti-patterns
In this section we will look at some common mistakes that violate the Single Responsibility Principle. Then we will talk about some ways to fix them. Let's take the below code as an example

```
type Envelope struct {
	message string
	db      *sql.DB
}

func (e *Envelope) SetMessage(msg string) {
	e.message = msg
}

func (e *Envelope) GetMessage() string {
	return e.message
}

func (e *Envelope) SaveToDB() error {
	//SAVING ENVELOPE's MESSAGE TO DATABASE
	return nil
}
```
Here we have a type called Envelope that holds fields like message and db. The design for envelope voilates SRP. 

This object and method attached to it deals with mixed responsiblites and logic like :
- getting and seting the message string.
- handling persistance at the database.

Having external dependencies and mixed logic make our message struct a **god object**, and having god objects in you rcode is always a bad idea.

### How can we achieve SRP?

We create new types such that each one of those types only have one single responsiblity.
```
//Envelope type and it's methods
type Envelope struct {
	message string
}

func (e *Envelope) SendMessage(msg string) {
	e.message = msg
}

func (e *Envelope) GetMessage() string {
	return e.message
}

//DB type, responsible for saving to the persistent storage
type DB struct {
	*sql.DB
}

func (d *DB) Save(env Envelope) error {
	//SAVING ENVELOPE's MESSAGE TO DATABASE
	return nil
}
```

The above code example staisfies SRP.
- The message objects only dealts with functionalities directly related to the Envelope.
- The logic for persistance is handled by a new DB object.

Now our structs structure obeys the Single Responsibility Principle and every struct and it's methods are responsible for one aspect of our application.

## Open/Closed Principle
The Open-Closed Principle states that **a software entities should be open for extension and closed to modification**.

Modification means changing the code of an existing class/entity, and extension means adding new functionality. We should be able to add new functionality without touching the existing code for the class or struct in this case. This is because whenever we modify the existing code, we are taking the risk of creating potential bugs. So we should avoid touching the tested and reliable (mostly) production code if possible.

The open / closed principle is achieved in Go using **embedded types**. Embedding one struct into another allows access to the embedded type’s fields and methods, thus the embedded type is open for extension.

```
package main

import "fmt"

type Vehicle struct {
	manufacturingYear int
}

func (v Vehicle) PrintInfo() {
	fmt.Printf("Vehicle's manufacturing year is: %d\n", v.manufacturingYear)
}

func (v Vehicle) Emissions() int {
    return 200
}

func (v Vehicle) PrintEmissions() {
    fmt.Printf("Vehicle's emissions: %d\n", v.Emissions())
}

type ElectricVehicle struct {
	Vehicle
}

func (ev ElectricVehicle) Emissions() int {
    return 0
}

func (ev ElectricVehicle) PrintInfo() {
	fmt.Printf("ElectricVehicle's manufacturing year is: %d\n", ev.manufacturingYear)
}

func main() {
    var vehicle Vehicle
    vehicle.manufacturingYear = 2019

    var electricVehicle ElectricVehicle
    electricVehicle.manufacturingYear = 2020

    // open for extension
    vehicle.PrintInfo() // Vehicle's manufacturing year is: 2019
    electricVehicle.PrintInfo() // ElectricVehicle's manufacturing year is: 2020

    // closed for modification
    fmt.Println(electricVehicle.Emissions()) // prints 0
    electricVehicle.PrintEmissions() // prints Vehicle's emissions: 200, instead of 0
}
```

In the example above, the **Vehicle** type is embedded inside the **ElectricVehicle** type.
- **ElectricVehicle** can access all **Vehicles’s methods**, but because **ElectricVehicle** has its own _PrintInfo()_ method it overrides the one from **Vehicle**. We can still access the embedded type’s _PrintInfo()_ method using: **_electricVehicle.Vehicle.PrintInfo()_**
- **ElectricVehicle** can access all **Vehicle’s** private fields, e.g. _manufacturingYear_ field as if it were defined in **ElectricVehicle**.

However, **the embedded type is closed for modification**. The **Vehicle’s** _PrintEmissions_ method is defined with Vehicle as a receiver, calling it from another type where Vehicle is embedded inside will not alter the method’s definition.
When the _PrintEmissions_ method is called from **ElectricVehicle**, the value of _v.Emissions()_ will be from Vehicle, because _PrintEmissions_ method is called with **Vehicle** as receiver.

## Liskov Substitution Principle

Coined by Barbara Liskov, the Liskov substitution principle states, roughly, that two types are substitutable if they exhibit behaviour such that the caller is unable to tell the difference.

A method declaration in Go is syntactic sugar for a function that has an implicit first parameter, called **receiver**.

```
func (v Vehicle) PrintEmissions() {
    fmt.Printf("Vehicle's emissions: %d\n", v.Emissions())
}

// equivalent to:

func PrintEmissions(v Vehicle) {
    fmt.Printf("Vehicle's emissions: %d\n", v.Emissions())
}
```
Because Go doesn’t support function overloading calling _func PrintEmissions(v Vehicle)_ with an **ElectricVehicle** as argument yields an error:
cannot use _electricVehicle (type ElectricVehicle) as type Vehicle in argument to PrintEmissions_

And declaring:

```
func PrintEmissions(v ElectricVehicle) {
  fmt.Printf("ElectricVehicle's emissions: %d\n", v.Emissions())
}
```
gives error: _PrintEmissions redeclared in this block ... previous declaration at ...._

Therefore, we cannot substitute an **ElectricVehicle** for a **Vehicle** struct type.

To fix this, we can either implement the _func (v ElectricVehicle) PrintEmissions()_ method in the **ElectricVehicle** type
or define a new interface and a function that accepts it and does the actual printing for all vehicles that implement the interface.

```
type Emissioner interface {
    Emissions() int
}

func PrintEmissions(vehicleName string, e Emissioner) {
  fmt.Printf("%s emissions: %d\n", vehicleName, e.Emissions())
}

// called from main.go as:
PrintEmissions("Vehicle", vehicle)
PrintEmissions("ElectricVehicle", electricVehicle)
// Vehicle emissions: 200
// ElectricVehicle emissions: 0 <-- correct output!
```

In other languages, this principle is implemented with an abstract base class and several concrete subtypes extending it.
However, in Go we don’t have classes, nor inheritance, this means we will implement **substitution using interfaces**.

**Types in Go implement a particular interface simply by having a matching set of methods,
i.e. interfaces are satifised implicitly, rather than explicitly.**

It is common for interfaces to have a single method, thus small interfaces lead to simple implementations.
This creates packages composed of simple implementations connected by common behaviour.

For example, the **io.Reader** interface:

```
type Reader interface {
    // Read reads up to len(buf) bytes into buf
    Read(buf []byte) (n int, err error)
}
```

By having multiple types implement this interface we can read data from any of them in the same way.
As a client reading data, we don’t care what each type is doing internally to give us the data.

## Interface Segregation Principle

**A client should not be forced to implement an interface that it doesn’t use.**

Golang **interfaces** are your best friends when it comes to mocking an object or to specify a well scoped set of functionalities required by a function to interact with an object.

We can have an entire object that does a lot of cool things, but when it's passsed to a function only a subset of it get used, that’s when the structure can be replaced by an interface that only requires what it is needed by the structure.

Let's consider a **Resource** interface:
```
type Resource interface {
    Create(ctx context.Context) error
    Update(ctx context.Context, updated interface{}) error
    Delete(ctx context.Context) error
}
```

A strategy to make an interface smaller in this case is to break it in actions:
```
type Creatable interface {
    Create(ctx context.Context) error
}

type Updatable interface {
    Update(ctx context.Context, updated interface{}) error
}

type Deletable interface {
    Delete(ctx context.Context) error
}
```

And we can use **composition** to create an interface that requires all the three actions to work if we need it:

```
type Persistable interface {
    Deletable
    Updatable
    Creatable
}
```

This is useful when a function uses more than one of those actions, if you have an interface that also contains Get or View we can think about a different split ReadOnly contains Get, View and Modifiable that will require only the functions Update, Create, Delete.

**A great rule of thumb for Go is accept interfaces, return structs.**

## Dependency Inversion Principle

The final SOLID principle is the dependency inversion principle, which states:

**_High-level modules should not depend on low-level modules. Both should depend on abstractions.
Abstractions should not depend on details. Details should depend on abstractions._**

In Go, this principle can be applied by depending on interfaces in lower level code (at package boundaries) and by pushing the responsibility of providing concrete implementations to higher level code.

```
package persistence

import "fmt"

// Storer is the interface responsible for storing data in a storage location.
type Storer interface {
  Store(data interface{}) (int, error)
}

// Persister is the interface used to persist data on behalf of its clients
type Persister interface {
  Persist(data interface{}) error
}

// NewPersister creates a concrete implementation of the Persister interface
func NewPersister(store Storer) Persister {
  return persistence{
    storage: store,
  }
}

type persistence struct {
  storage Storer
}

func (p persistence) Persist(data interface{}) error {
  _, err := p.storage.Store(data)
  if err != nil {
    return fmt.Errorf("Cannot save data to storage: %s\n", err)
  }
  return nil
} 

// -----------------------------------

package storage

// Storage defines the storage medium/location of the saved data
type Storage interface {
  Store(data interface{}) (int, error)
}

// NewStorage returns a concrete implementation of the Storage interface
func NewStorage() Storage {
  return dataStore{}
}

type dataStore struct {
  count int
  data []interface{}
}

func (ds dataStore) Store(data interface{}) (int, error) {
  ds.count++
  ds.data = append(ds.data, data)
  return ds.count, nil
}

// -----------------------------------

package main

import (
  "./storage"
  "./persistence"
)

// main is the high level package that is the only one aware of the two components, 
// thus the lower level abstractions Persister and Storage are said to be decoupled from one another
func main() {
  dataStore := storage.NewStorage()
  persistor := persistence.NewPersister(dataStore)
  persistor.Persist("Go is awesome!")
}
```
Due to the duck typing property: _If it walks like duck and it quacks like a duck, then it is a duck_,
the **Storage** interface from the **storage** package is treated to be the same as the Storer interface from the **persistence** package, that’s why **NewPersister** constructor function any type that has the same method set.

At compile time there is no dependency between the two packages, but at runtime we can see that the **persistence** package depends on the concrete implementation created in the storage package.

## TLDR

To recap, when applied to Go, each of the SOLID principles are powerful statements about design, but taken together they have a central theme.
- The Single Responsibility Principle encourages you to structure the functions, types, and methods into packages that exhibit natural cohesion; the types belong together, the functions serve a single purpose.
- The Open / Closed Principle encourages you to compose simple types into more complex ones using embedding.
- The Liskov Substitution Principle encourages you to express the dependencies between your packages in terms of interfaces, not concrete types. By defining small interfaces, we can be more confident that implementations will faithfully satisfy their contract.
- The Interface Substitution Principle takes that idea further and encourages you to define functions and methods that depend only on the behaviour that they need. If your function only requires a parameter of an interface type with a single method, then it is more likely that this function has only one responsibility.
- The Dependency Inversion Principle encourages you move the knowledge of the things your package depends on from compile time–in Go we see this with a reduction in the number of import statements used by a particular package–to run time.

