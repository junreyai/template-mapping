'use client';

import React from 'react';
import Image from 'next/image';
import Link from 'next/link';

const Home = () => {
  const categories = [
    {
      title: 'Create',
      image: '/images/create.png',
      href: '/create',
      description: 'Create and customize your own Excel template'
    },
    {
      title: 'Business',
      image: '/images/business.png',
      href: '/business',
      description: 'Professional business templates for your organization'
    },
    {
      title: 'Marketing',
      image: '/images/marketing.png',
      href: '/marketing',
      description: 'Effective marketing templates to boost your campaigns'
    },
    {
      title: 'Multi-Purpose',
      image: '/images/multi.png',
      href: '/multi',
      description: 'Versatile templates for various needs and projects'
    },
    {
      title: 'Education',
      image: '/images/education.png',
      href: '/edu',
      description: 'Educational templates for learning and teaching'
    }
  ];

  return (
    <div className="min-h-[calc(100vh-56px)] bg-gradient-to-b from-white to-blue-50 scrollbar-hide">
      <div className="max-w-[2000px] mx-auto px-4 sm:px-6 lg:px-8 py-6 scrollbar-hide">
        {/* Hero Section */}
        <section className="text-center mb-10 animate-fadeIn">
          <h1 className="text-3xl md:text-4xl font-bold text-transparent bg-clip-text bg-gradient-to-r from-blue-400 to-blue-600 mb-4">
            Excel Mapping Templates
          </h1>
          <div className="max-w-3xl mx-auto">
            <p className="text-base md:text-lg text-gray-600 mb-4">
              Choose from our extensive collection of professionally designed Excel templates to streamline your work and boost productivity. Whether you're managing business operations, planning marketing campaigns, or organizing educational resources, we have the perfect template for you.
            </p>
            <p className="text-base md:text-lg text-gray-600">
              Simply select a category below to explore templates, or create your own custom template to match your specific needs. All templates are free to use and fully customizable.
            </p>
          </div>
        </section>

        {/* Categories Section */}
        <div className="flex justify-center mb-10">
          <div className="w-full overflow-hidden scrollbar-hide">
            <div className="overflow-x-auto scrollbar-hide">
              <div className="flex justify-center min-w-max">
                <section className="flex gap-8">
                  {categories.map((category, index) => (
                    <div
                      key={category.title}
                      className="group animate-fadeIn w-[300px]"
                      style={{ animationDelay: `${index * 100}ms` }}
                    >
                      <Link href={category.href} className="block">
                        <div className="bg-white rounded-xl shadow-lg overflow-hidden transition-all duration-300 hover:shadow-2xl transform hover:-translate-y-1 h-full">
                          <div className="relative h-[200px] overflow-hidden">
                            <div className="absolute inset-0 transition-transform duration-300 transform group-hover:scale-105">
                              <Image
                                src={category.image}
                                alt={category.title}
                                fill
                                style={{ objectFit: 'contain', padding: '20px' }}
                                className="transition-transform duration-300"
                                priority={index < 2}
                              />
                            </div>
                          </div>
                          <div className="p-6 bg-white">
                            <h2 className="text-lg md:text-xl font-semibold text-gray-800 mb-3 group-hover:text-blue-500 transition-colors">
                              {category.title}
                            </h2>
                            <p className="text-base text-gray-600 leading-relaxed">
                              {category.description}
                            </p>
                          </div>
                        </div>
                      </Link>
                    </div>
                  ))}
                </section>
              </div>
            </div>
          </div>
        </div>

        {/* Footer Section */}
        <div className="text-center">
          <p className="text-base text-gray-500">
            All templates are professionally designed and regularly updated. Need help? Contact our support team.
          </p>
        </div>
      </div>
    </div>
  );
};

export default Home;