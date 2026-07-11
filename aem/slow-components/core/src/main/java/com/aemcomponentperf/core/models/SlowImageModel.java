package com.aemcomponentperf.core.models;

import org.apache.sling.api.SlingHttpServletRequest;
import org.apache.sling.models.annotations.DefaultInjectionStrategy;
import org.apache.sling.models.annotations.Model;
import org.slf4j.Logger;
import org.slf4j.LoggerFactory;

import javax.annotation.PostConstruct;

@Model(
    adaptables = SlingHttpServletRequest.class,
    defaultInjectionStrategy = DefaultInjectionStrategy.OPTIONAL
)
public class SlowImageModel {

    private static final Logger log = LoggerFactory.getLogger(SlowImageModel.class);

    @PostConstruct
    protected void init() {
        try {
            log.debug("SlowImageModel: simulating 4s backend delay");
            Thread.sleep(4_000);
        } catch (InterruptedException e) {
            Thread.currentThread().interrupt();
        }
    }
}
