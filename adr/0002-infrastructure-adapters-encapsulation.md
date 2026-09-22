# Encapsulate service-specific logic in infrastructure adapters

To prevent coupling the core domain logic to external libraries, third-party SDKs, frameworks, or specific request/response schemas, all service-specific code is encapsulated in dedicated adapter modules. Domain services interact with external systems exclusively through clean, abstract interfaces or protocols defined in the core layer. This boundary keeps business rules stable and simplifies replacing or upgrading third-party integrations.
