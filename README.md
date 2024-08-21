# About
Built on [Cillers](https://docs.cillers.com/)

This repo is my entry to the hackathon [Monterro and Cillers: Nordic Software AI Hackathon At Waterfront](https://baaboom.confetti.events/nordic-software-hackathon-at-waterfront). 

Please note that this was very rushed with no experience with any of the tech in the Cillers stack (except Docker ofc). You will see a lot of sussy code so please don't hold it that much against me :p. 

On main difference from the scafolded stack is that I implemented the api in golang for mainly two reason. First is that hopping in with so much generated code is confusing and you don't really learn anything about the tech stack. Second is that I think Python is nasty for backend, bleh :p. 

Ended up skipping the whole GraphQL part to make sure to at least get something done xd. The graphql package use on the backend is [gqlgen](https://gqlgen.com/). It was really easy to setup and nice to work with. Even so graphql was new to me and it would take extra time learn to use it well in a full stack so I dropped it. Can see the remnants under _code/go-api/graph_.

# The AI part
The OpenAI integration was done by [Erik Lidbom](https://github.com/erik-lidbom), can be found under _code/web-app/src/components/ScheduleOverview_ and _code/web-app/src/components/OnBoarding_ so make sure to give him a message if you're curious. 

Erik is a software student and neither of us have integerated with any kind of AI before so its very crude.
